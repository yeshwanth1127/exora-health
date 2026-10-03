import pytest

from app.agent import Agent, SEARCH_ACK, accepts_enquiry, direct_reply, is_service_intake, needs_knowledge_search, search_query, system_prompt
from app.llm import ChatResult, _metrics, is_internal_speech, pick_local_model, spoken_reply
from app.main import merge_request


class ScriptedLLM:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    async def __call__(self, messages, tools, settings):
        self.calls.append({'messages': messages, 'tools': tools, 'settings': settings})
        return self.responses.pop(0)


@pytest.mark.asyncio
async def test_hello_replies_without_calling_the_model():
    llm = ScriptedLLM([])

    async def search(query, settings):
        raise AssertionError('search should not run')

    async def capture(fields, text, memory):
        raise AssertionError('capture should not run')

    result = await Agent(llm, search, capture).run('Hello', [], {
        'agent_name': 'Maya', 'business_name': 'Meridian Multispeciality Hospital', 'instructions': 'Be calm.',
    }, {})
    assert result['searched'] is False
    assert 'Maya' in result['answer']
    assert 'Meridian Multispeciality Hospital' in result['answer']
    assert result['metrics']['fallback'] == 'direct'
    assert llm.calls == []


def test_needs_knowledge_search_covers_business_facts_not_intake_or_chitchat():
    assert needs_knowledge_search('What time do you guys open?')
    assert needs_knowledge_search('How much does a visit cost?')
    assert needs_knowledge_search('Do you have a cardiology department?')
    assert not needs_knowledge_search('Which doctors are available?')
    assert needs_knowledge_search('Can you interpret my lab report?')
    assert needs_knowledge_search('Can you tell me about the hospital?')
    assert not needs_knowledge_search('Hello')
    assert not needs_knowledge_search('What can you do for me?')
    assert not needs_knowledge_search('My name is Priya. I need a cardiology appointment in Whitefield.')
    assert is_service_intake('My name is Priya. I need a cardiology appointment in Whitefield.')
    assert search_query('Which doctors are available?') == 'complete doctor list names specialties Avocado Health'


@pytest.mark.asyncio
async def test_hospital_overview_is_grounded_with_a_search():
    searches = []

    async def search(query, settings):
        searches.append(query)
        return [{'id': 'overview1', 'locator': 'Hospital overview', 'name': 'meridian.md',
                 'text': 'Meridian is a multispeciality hospital.', 'similarity': 0.9, 'document_id': 'd1'}]

    async def capture(fields, text, memory):
        raise AssertionError('capture should not run')

    llm = ScriptedLLM([ChatResult(content='Meridian is a multispeciality hospital with outpatient and diagnostic services.')])
    result = await Agent(llm, search, capture).run(
        'Can you tell me about the hospital?', [],
        {'agent_name': 'Maya', 'business_name': 'Meridian Multispeciality Hospital', 'instructions': ''}, {})
    assert searches == ['Avocado Health Exora HMS hospital facility Bengaluru']
    assert result['searched'] is True
    assert result['answer'].startswith('Meridian is')


@pytest.mark.asyncio
async def test_yes_after_enquiry_offer_starts_short_local_intake():
    llm = ScriptedLLM([])

    async def search(query, settings):
        raise AssertionError('search should not run')

    async def capture(fields, text, memory):
        raise AssertionError('capture should not run before details are provided')

    history = [{'role': 'assistant', 'content': 'Would you like me to record an enquiry for you?'}]
    memory = {}
    assert accepts_enquiry('Yes.', history)
    result = await Agent(llm, search, capture).run(
        'Yes.', history,
        {'agent_name': 'Maya', 'business_name': 'Meridian Multispeciality Hospital', 'instructions': ''}, memory)
    assert result['metrics']['fallback'] == 'direct'
    assert "What's your name?" in result['answer']
    assert 'locally' in result['answer']
    assert memory['intake_active'] is True


@pytest.mark.asyncio
async def test_business_question_prefetches_before_llm():
    searches = []

    async def search(query, settings):
        searches.append(query)
        return [{'id': 'hours1', 'locator': 'Outpatient hours', 'name': 'meridian.md',
                 'text': 'Outpatient departments are open 8 to 8', 'similarity': 0.8, 'document_id': 'd1'}]

    async def capture(fields, text, memory):
        raise AssertionError('capture should not run')

    llm = ScriptedLLM([ChatResult(content='Outpatient departments are open Monday to Saturday from 8 to 8.')])
    events = []

    async def on_event(kind, **data):
        events.append((kind, data))

    result = await Agent(llm, search, capture).run(
        'What time do you guys open?', [],
        {'agent_name': 'Maya', 'business_name': 'Meridian Multispeciality Hospital', 'instructions': ''}, {},
        on_event=on_event)
    assert searches == ['outpatient hours']
    assert result['searched'] is True
    assert llm.calls[0]['messages'][-1]['role'] == 'tool'
    assert 'hours1' in llm.calls[0]['messages'][-1]['content']
    assert events[0][0] == 'tools_start'
    assert events[1][0] == 'sources'


@pytest.mark.asyncio
async def test_hospital_fact_question_does_not_get_hijacked_by_an_active_booking():
    searches = []

    async def search(query, settings):
        searches.append(query)
        return [{'id': 'hours1', 'locator': 'Outpatient hours', 'name': 'meridian.md',
                 'text': 'Open from 8 AM to 8 PM.', 'similarity': 0.9, 'document_id': 'd1'}]

    async def capture(fields, text, memory):
        raise AssertionError('capture should not run')

    async def operate(name, args, memory):
        raise AssertionError('booking backend should not run for an hours question')

    llm = ScriptedLLM([ChatResult(content='Outpatient departments are open from 8 AM to 8 PM.')])
    memory = {}
    agent = Agent(llm, search, capture, operate)
    await agent.run('I want to book an appointment', [], {
        'agent_name': 'Maya', 'business_name': 'Meridian', 'instructions': '',
    }, memory)
    result = await agent.run('Before that, what are your opening hours?', [], {
        'agent_name': 'Maya', 'business_name': 'Meridian', 'instructions': '',
    }, memory)

    assert searches == ['outpatient hours']
    assert result['answer'] == 'Outpatient departments are open from 8 AM to 8 PM.'
    assert memory['workflow']['active'] is True
    assert 'specialty' not in memory['workflow']['values']


def test_direct_reply_only_matches_bare_greetings():
    settings = {'agent_name': 'Maya', 'business_name': 'Meridian Multispeciality Hospital'}
    assert direct_reply('hello', settings)
    assert direct_reply('Good morning.', settings)
    assert direct_reply('thanks', settings)
    assert direct_reply('Hello, what are your hours?', settings) is None


@pytest.mark.asyncio
async def test_hello_and_capabilities_do_not_search():
    searches = []

    async def search(query, settings):
        searches.append(query)
        return [{'id': 'x', 'locator': 'Fees', 'name': 'demo.md', 'text': '499', 'similarity': 0.9}]

    async def capture(fields, text, memory):
        raise AssertionError('capture should not run')

    llm = ScriptedLLM([ChatResult(content="Hello, I'm Maya, the assistant for Meridian Multispeciality Hospital. How can I help?")])
    result = await Agent(llm, search, capture).run('What can you do for me?', [], {
        'agent_name': 'Maya', 'business_name': 'Meridian Multispeciality Hospital', 'instructions': 'Be calm.',
    }, {})
    assert searches == []
    assert result['searched'] is False
    assert result['source_ids'] == []
    assert 'knowledge base' not in result['answer'].lower()
    assert llm.calls and 'search_knowledge' in str(llm.calls[0]['tools'])
    tool_names = {tool['function']['name'] for tool in llm.calls[0]['tools']}
    assert not {'create_slot_hold', 'confirm_appointment', 'release_slot_hold'} & tool_names


@pytest.mark.asyncio
async def test_opening_hours_rewrites_query_and_searches():
    searches = []

    async def search(query, settings):
        searches.append(query)
        return [{'id': 'hours1', 'locator': 'Outpatient hours', 'name': 'meridian.md',
                 'text': 'Outpatient departments are open 8 to 8', 'similarity': 0.8, 'document_id': 'd1'}]

    async def capture(fields, text, memory):
        raise AssertionError('capture should not run')

    llm = ScriptedLLM([
        ChatResult(tool_calls=[{'id': 'c1', 'name': 'search_knowledge', 'arguments': {'query': 'outpatient hours'}}]),
        ChatResult(content='Outpatient departments are open Monday to Saturday from 8 to 8.'),
    ])
    events = []

    async def on_event(kind, **data):
        events.append((kind, data))

    result = await Agent(llm, search, capture).run(
        'Hey, what time do you folks even open?', [],
        {'agent_name': 'Maya', 'business_name': 'Meridian Multispeciality Hospital', 'instructions': ''}, {},
        on_event=on_event)
    assert searches == ['outpatient hours']
    assert result['searched'] is True
    assert result['source_ids'] == ['hours1']
    assert result['needs_human'] is False
    assert events[0][0] == 'tools_start'
    assert events[0][1]['ack'] == SEARCH_ACK
    assert events[1][0] == 'sources'


@pytest.mark.asyncio
async def test_empty_search_does_not_invent_a_price():
    async def search(query, settings):
        return []

    async def capture(fields, text, memory):
        raise AssertionError('capture should not run')

    llm = ScriptedLLM([
        ChatResult(tool_calls=[{'id': 'c1', 'name': 'search_knowledge', 'arguments': {'query': 'MRI cost'}}]),
        ChatResult(content="I don't have that in the knowledge base. I can record a question for a human to review."),
    ])
    result = await Agent(llm, search, capture).run(
        'How much does an MRI cost?', [],
        {'agent_name': 'Maya', 'business_name': 'Meridian Multispeciality Hospital', 'instructions': ''}, {})
    assert result['searched'] is True
    assert result['needs_human'] is True
    assert '1200' not in result['answer']
    assert result['source_ids'] == []
    tool_msg = llm.calls[1]['messages'][-1]
    assert tool_msg['role'] == 'tool'
    assert tool_msg['content'] == '[]'


@pytest.mark.asyncio
async def test_capture_request_merges_verified_transcript_fields():
    captured = []

    async def search(query, settings):
        raise AssertionError('search should not run')

    async def capture(fields, text, memory):
        captured.append((fields, text))
        return merge_request(fields, text, memory)

    llm = ScriptedLLM([
        ChatResult(tool_calls=[{'id': 'c1', 'name': 'capture_request',
                                'arguments': {'name': 'Priya', 'service': 'cardiology', 'area': 'Whitefield'}}]),
        ChatResult(content='I can note a cardiology appointment enquiry in Whitefield for Priya. What phone number should staff use?'),
    ])
    memory = {}
    text = 'My name is Priya. I need a cardiology appointment in Whitefield.'
    result = await Agent(llm, search, capture).run(
        text, [], {'agent_name': 'Maya', 'business_name': 'Meridian Multispeciality Hospital', 'instructions': ''}, memory)
    assert captured and captured[0][0]['name'] == 'Priya'
    assert result['needs_human'] is True
    assert memory['slots']['name']['value'] == 'Priya'
    assert memory['slots']['area']['value'] == 'Whitefield'


@pytest.mark.asyncio
async def test_live_doctor_lookup_uses_hospital_operation_not_knowledge():
    operations = []

    async def search(query, settings):
        raise AssertionError('live doctors must not come from the static knowledge base')

    async def capture(fields, text, memory):
        raise AssertionError('capture should not run')

    async def operate(name, args, memory):
        operations.append((name, args))
        return [{'id': 'doctor-1', 'name': 'Dr. Live', 'departments': ['Cardiology']}]

    llm = ScriptedLLM([
        ChatResult(tool_calls=[{'id': 'live-1', 'name': 'find_doctors', 'arguments': {'department': 'cardiology'}}]),
        ChatResult(content='Dr. Live is available in Cardiology. Which clinic would you prefer?'),
    ])
    result = await Agent(llm, search, capture, operate).run(
        'Which cardiology doctors are available?', [],
        {'agent_name': 'Maya', 'business_name': 'Meridian Multispeciality Hospital', 'instructions': ''}, {})
    assert operations == [('find_doctors', {'department': 'cardiology'})]
    assert 'Dr. Live' in result['answer']
    assert 'which doctor' not in result['answer'].lower()
    assert result['searched'] is False
    assert result['needs_human'] is False


@pytest.mark.asyncio
async def test_dated_doctor_query_checks_live_slots_before_listing_doctors():
    operations = []
    doctors = [
        {'id': 'doctor-1', 'name': 'Dr. Open', 'title': 'Cardiologist',
         'departments': ['Cardiology'],
         'branches': [{'id': 'branch-1', 'name': 'Central', 'area': 'Central'}]},
        {'id': 'doctor-2', 'name': 'Dr. Full', 'title': 'Physician',
         'departments': ['General Medicine'],
         'branches': [{'id': 'branch-1', 'name': 'Central', 'area': 'Central'}]},
    ]

    async def search(query, settings):
        raise AssertionError('dated availability must not use static knowledge')

    async def capture(fields, text, memory):
        raise AssertionError('capture should not run')

    async def operate(name, args, memory):
        operations.append((name, args))
        if name == 'find_doctors':
            return doctors
        if name == 'get_availability':
            slots = ([{'starts_at': f"{args['start_date']}T03:30:00+00:00",
                       'ends_at': f"{args['start_date']}T04:00:00+00:00"}]
                     if args['doctor_id'] == 'doctor-1' else [])
            return {'timezone': 'Asia/Kolkata', 'slots': slots}
        raise AssertionError(name)

    result = await Agent(ScriptedLLM([]), search, capture, operate).run(
        'Which doctors are available tomorrow?', [],
        {'agent_name': 'Maya', 'business_name': 'Meridian', 'instructions': ''}, {})

    assert 'Dr. Open' in result['answer']
    assert 'Dr. Full' not in result['answer']
    assert result['metrics']['tool_calls'] == ['find_doctors', 'get_availability']
    checked_ids = {args['doctor_id'] for name, args in operations if name == 'get_availability'}
    assert checked_ids == {'doctor-1', 'doctor-2'}


@pytest.mark.asyncio
async def test_dated_virtual_doctor_query_uses_only_virtual_schedules():
    operations = []
    doctor = {
        'id': 'doctor-1', 'name': 'Dr. Virtual', 'title': 'Cardiologist',
        'departments': ['Cardiology'], 'accepts_virtual': True,
        'branches': [{'id': 'physical-1', 'name': 'Central', 'area': 'Central'}],
        'in_person_branches': [{'id': 'physical-1', 'name': 'Central', 'area': 'Central'}],
        'virtual_branches': [{'id': 'virtual-1', 'name': 'Virtual Care', 'area': 'Virtual Care'}],
    }

    async def unused(*args, **kwargs):
        raise AssertionError('dated virtual availability must use only the hospital backend')

    async def operate(name, args, memory):
        operations.append((name, args))
        if name == 'find_doctors':
            return [doctor]
        if name == 'get_availability':
            assert args['branch_id'] == 'virtual-1'
            assert args['consultation_type'] == 'virtual'
            return {'timezone': 'Asia/Kolkata', 'slots': [{
                'starts_at': f"{args['start_date']}T09:00:00+05:30",
                'ends_at': f"{args['start_date']}T09:30:00+05:30",
            }]}
        raise AssertionError(name)

    memory = {}
    result = await Agent(ScriptedLLM([]), unused, unused, operate).run(
        'Which cardiology doctors are available virtually tomorrow?', [],
        {'agent_name': 'Maya', 'business_name': 'Meridian', 'instructions': ''}, memory)

    assert 'Dr. Virtual has an open virtual appointment' in result['answer']
    assert 'Virtual Care' in result['answer']
    assert memory['workflow']['values']['consultation_type']['value'] == 'virtual'
    assert [name for name, _ in operations] == ['find_doctors', 'get_availability']


@pytest.mark.asyncio
async def test_internal_model_reasoning_is_never_returned_by_fallback():
    leaked = "Wait, the assistant's response was wrong. The instructions say the tools available are find_doctors."

    async def unused(*args, **kwargs):
        raise AssertionError('no tool should run')

    result = await Agent(
        ScriptedLLM([ChatResult(content=leaked)]), unused, unused,
    ).run('Yeah, I will set that up.', [], {
        'agent_name': 'Maya', 'business_name': 'Meridian', 'instructions': '',
    }, {})

    assert result['answer'] == 'Sorry, I missed that. Could you say it again?'
    assert 'instructions' not in result['answer'].lower()


@pytest.mark.asyncio
async def test_live_directory_uses_full_specialty_map_and_never_invents_a_choice():
    operations = []

    async def search(query, settings):
        raise AssertionError('live doctors must not come from static knowledge')

    async def capture(fields, text, memory):
        raise AssertionError('capture should not run')

    async def operate(name, args, memory):
        operations.append((name, args))
        return [{'id': 'eye-1', 'name': 'Dr. Sana Ahmed', 'title': 'Ophthalmologist',
                 'departments': ['Ophthalmology'], 'accepts_virtual': False}]

    result = await Agent(ScriptedLLM([]), search, capture, operate).run(
        'Which ophthalmology doctors are available?', [],
        {'agent_name': 'Maya', 'business_name': 'Meridian', 'instructions': ''}, {})

    assert operations == [('find_doctors', {'department': 'ophthalmology'})]
    assert result['answer'] == 'The live directory currently lists Dr. Sana Ahmed, Ophthalmologist.'


@pytest.mark.asyncio
async def test_pronoun_availability_followup_uses_the_single_directory_doctor():
    operations = []
    doctor = {
        'id': 'doctor-1', 'name': 'Dr. Vikram Rao',
        'title': 'Senior Consultant, Interventional Cardiology',
        'departments': ['Cardiology'], 'accepts_virtual': True,
        'branches': [
            {'id': 'branch-1', 'name': 'Central Clinic', 'area': 'Central'},
            {'id': 'branch-2', 'name': 'North Clinic', 'area': 'North'},
        ],
    }

    async def search(query, settings):
        raise AssertionError('availability must use the live hospital backend')

    async def capture(fields, text, memory):
        raise AssertionError('capture should not run')

    async def operate(name, args, memory):
        operations.append((name, args))
        if name == 'find_doctors':
            return [doctor]
        raise AssertionError(name)

    memory = {}
    agent = Agent(ScriptedLLM([]), search, capture, operate)
    first = await agent.run('Which cardiology doctors are available?', [],
                            {'agent_name': 'Maya', 'business_name': 'Meridian', 'instructions': ''}, memory)
    second = await agent.run('When is he available?', [],
                             {'agent_name': 'Maya', 'business_name': 'Meridian', 'instructions': ''}, memory)

    assert 'Dr. Vikram Rao' in first['answer']
    assert second['answer'] == 'Which clinic location works for you: Central, North?'
    assert memory['workflow']['values']['doctor']['value'] == 'doctor-1'
    assert operations == [('find_doctors', {'department': 'cardiology'})]


@pytest.mark.asyncio
async def test_pronoun_followup_recovers_doctor_context_from_resumed_history():
    doctor = {
        'id': 'doctor-1', 'name': 'Dr. Vikram Rao', 'title': 'Cardiologist',
        'departments': ['Cardiology'],
        'branches': [{'id': 'branch-1', 'name': 'Central Clinic', 'area': 'Central'}],
    }

    async def search(query, settings):
        raise AssertionError('search should not run')

    async def capture(fields, text, memory):
        raise AssertionError('capture should not run')

    async def operate(name, args, memory):
        assert name == 'find_doctors'
        assert args == {'department': 'cardiology'}
        return [doctor]

    history = [
        {'role': 'user', 'content': 'Which cardiology doctors are available?'},
        {'role': 'assistant', 'content': 'The live directory currently lists Dr. Vikram Rao, Cardiologist.'},
    ]
    result = await Agent(ScriptedLLM([]), search, capture, operate).run(
        'When is he available?', history,
        {'agent_name': 'Maya', 'business_name': 'Meridian', 'instructions': ''}, {})

    assert result['answer'] == 'Dr. Vikram Rao currently has appointments at Central. Would you like that location?'


@pytest.mark.asyncio
async def test_context_free_pronoun_asks_for_the_doctor_instead_of_claiming_backend_failure():
    async def search(query, settings):
        raise AssertionError('search should not run')

    async def capture(fields, text, memory):
        raise AssertionError('capture should not run')

    result = await Agent(ScriptedLLM([]), search, capture, operate=None).run(
        'When is he available?', [],
        {'agent_name': 'Maya', 'business_name': 'Meridian', 'instructions': ''}, {})

    assert result['answer'] == 'Which doctor do you mean?'


@pytest.mark.asyncio
async def test_ambiguous_pronoun_asks_which_doctor_then_preserves_branch_choice():
    branch = {'id': 'branch-1', 'name': 'Central Clinic', 'area': 'Central'}
    doctors = [
        {'id': 'doctor-1', 'name': 'Dr. One Rao', 'title': 'Cardiologist',
         'departments': ['Cardiology'], 'branches': [branch]},
        {'id': 'doctor-2', 'name': 'Dr. Two Shah', 'title': 'Cardiologist',
         'departments': ['Cardiology'], 'branches': [branch]},
    ]

    async def search(query, settings):
        raise AssertionError('search should not run')

    async def capture(fields, text, memory):
        raise AssertionError('capture should not run')

    async def operate(name, args, memory):
        if name == 'find_doctors':
            return doctors
        raise AssertionError(name)

    memory = {}
    agent = Agent(ScriptedLLM([]), search, capture, operate)
    await agent.run('Which cardiology doctors are available?', [],
                    {'agent_name': 'Maya', 'business_name': 'Meridian', 'instructions': ''}, memory)
    ambiguous = await agent.run('When is he available?', [],
                                {'agent_name': 'Maya', 'business_name': 'Meridian', 'instructions': ''}, memory)
    selected = await agent.run('the second one', [],
                               {'agent_name': 'Maya', 'business_name': 'Meridian', 'instructions': ''}, memory)

    assert ambiguous['answer'] == 'Which doctor do you mean: 1, Dr. One Rao; 2, Dr. Two Shah?'
    assert memory['workflow']['values']['doctor']['value'] == 'doctor-2'
    assert selected['answer'] == 'Dr. Two Shah currently has appointments at Central. Would you like that location?'


def test_system_prompt_tells_model_when_not_to_search():
    prompt = system_prompt({'agent_name': 'Maya', 'business_name': 'Meridian Multispeciality Hospital', 'instructions': 'Be calm.'})
    assert 'Do not search for greetings' in prompt
    assert 'search the knowledge base' in prompt
    assert '/no_think' in prompt
    assert 'spoken aloud' in prompt
    assert 'Never diagnose' in prompt
    assert 'emergency services' in prompt


def test_pick_local_model_falls_back_to_installed_qwen():
    assert pick_local_model('qwen3:8b', ['qwen3:4b']) == 'qwen3:4b'
    assert pick_local_model('qwen3:8b', ['qwen3:8b:latest', 'nomic-embed-text']) == 'qwen3:8b'


def test_metrics_use_real_elapsed_time_for_remote_models():
    metrics = _metrics(tokens=40, llm_ms=2000)
    assert metrics == {'llm_ms': 2000, 'tokens': 40, 'tokens_per_second': 20.0}


def test_spoken_reply_drops_reasoning_and_keeps_the_answer():
    dump = '''Okay, the user asked about opening hours. I called the search_knowledge function with "opening hours".
Let me count the words. First sentence: State the days.
Let me structure it as: "We're open Monday to Friday 9:00 AM–6:00 PM and Saturday 10:00 AM–2:00 PM. Closed Sundays."
The time zone might be extra.'''
    assert spoken_reply(dump) == "We're open Monday to Friday 9:00 AM–6:00 PM and Saturday 10:00 AM–2:00 PM. Closed Sundays."
    assert spoken_reply('<think>plan the answer</think>We open at 9.') == 'We open at 9.'
    assert spoken_reply('We are open 9 to 6.') == 'We are open 9 to 6.'


def test_spoken_reply_does_not_repeat_the_caller_question():
    dump = '''The user asked "What time do you guys open?" I should call search_knowledge.
We're open Monday to Friday from 9 to 6.'''
    assert spoken_reply(dump, avoid='What time do you guys open?') == "We're open Monday to Friday from 9 to 6."
    assert spoken_reply('"What time do you guys open?"', avoid='What time do you guys open?') == ''


def test_spoken_reply_rejects_system_prompt_leakage():
    leak = ('Call search_knowledge for hospital facts: outpatient hours, consultation fees, '
            'departments, insurance, visiting, or any documented policy.')
    assert is_internal_speech(leak)
    assert spoken_reply(leak, avoid='What time do you guys open?') == ''


@pytest.mark.asyncio
async def test_prompt_echo_without_tools_still_searches():
    searches = []

    async def search(query, settings):
        searches.append(query)
        return [{'id': 'hours1', 'locator': 'Outpatient hours', 'name': 'meridian.md',
                 'text': 'Outpatient departments are open 8 to 8', 'similarity': 0.8, 'document_id': 'd1'}]

    async def capture(fields, text, memory):
        raise AssertionError('capture should not run')

    leak = ('Call search_knowledge for hospital facts: outpatient hours, consultation fees, '
            'departments, insurance, visiting, or any documented policy.')
    llm = ScriptedLLM([
        ChatResult(content=leak),
        ChatResult(content='Outpatient departments are open Monday to Saturday from 8 to 8.'),
    ])
    result = await Agent(llm, search, capture).run(
        'What time do you guys open?', [],
        {'agent_name': 'Maya', 'business_name': 'Meridian Multispeciality Hospital', 'instructions': ''}, {})
    assert searches == ['outpatient hours']
    assert result['searched'] is True
    assert 'search_knowledge' not in result['answer']
    assert result['answer'] == 'Outpatient departments are open Monday to Saturday from 8 to 8.'


@pytest.mark.asyncio
async def test_echoed_question_without_tools_still_searches():
    searches = []

    async def search(query, settings):
        searches.append(query)
        return [{'id': 'hours1', 'locator': 'Outpatient hours', 'name': 'meridian.md',
                 'text': 'Outpatient departments are open 8 to 8', 'similarity': 0.8, 'document_id': 'd1'}]

    async def capture(fields, text, memory):
        raise AssertionError('capture should not run')

    llm = ScriptedLLM([
        ChatResult(content='The user asked "What time do you guys open?" I need to search.'),
        ChatResult(content='Outpatient departments are open Monday to Saturday from 8 to 8.'),
    ])
    result = await Agent(llm, search, capture).run(
        'What time do you guys open?', [],
        {'agent_name': 'Maya', 'business_name': 'Meridian Multispeciality Hospital', 'instructions': ''}, {})
    assert searches
    assert result['searched'] is True
    assert result['answer'] == 'Outpatient departments are open Monday to Saturday from 8 to 8.'


@pytest.mark.asyncio
async def test_reasoning_content_is_not_spoken_or_fed_back_with_tools():
    async def search(query, settings):
        return [{'id': 'h', 'locator': 'Outpatient hours', 'name': 'demo.md', 'text': 'Open 8 to 8', 'similarity': 0.9}]

    async def capture(fields, text, memory):
        raise AssertionError('capture should not run')

    llm = ScriptedLLM([
        ChatResult(content='I need to call the tool and count the words.',
                   tool_calls=[{'id': 'c1', 'name': 'search_knowledge', 'arguments': {'query': 'outpatient hours'}}]),
        ChatResult(content='Outpatient departments are open Monday to Saturday from 8 to 8.'),
    ])
    result = await Agent(llm, search, capture).run(
        'What are your opening hours?', [],
        {'agent_name': 'Maya', 'business_name': 'Meridian Multispeciality Hospital', 'instructions': ''}, {})
    assistant = next(m for m in llm.calls[1]['messages'] if m.get('tool_calls'))
    assert assistant['content'] == ''
    assert result['answer'] == 'Outpatient departments are open Monday to Saturday from 8 to 8.'
    assert 'count the words' not in result['answer']
