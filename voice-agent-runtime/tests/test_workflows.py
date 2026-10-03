from datetime import date

import pytest

from app.agent import Agent
from app.workflows import DateStep, WorkflowEngine, _parse_date


SETTINGS = {
    "agent_name": "Maya",
    "business_name": "Meridian Multispeciality Hospital",
    "instructions": "Be calm.",
}


class NeverLLM:
    def __init__(self):
        self.calls = 0

    async def __call__(self, messages, tools, settings):
        self.calls += 1
        raise AssertionError("the deterministic booking workflow must not need the language model")


class Clinic:
    def __init__(self, slots=True):
        self.calls = []
        self.slots = slots
        self.branch = {"id": "branch-1", "name": "Indiranagar Flagship Clinic", "area": "Indiranagar"}
        self.other_branch = {"id": "branch-2", "name": "Whitefield Technology Hub", "area": "Whitefield"}
        self.doctor = {
            "id": "doctor-1", "name": "Dr. Vikram Rao", "title": "Cardiologist",
            "fee_inr": 1200, "accepts_virtual": True,
            "departments": ["Cardiology"], "branches": [self.branch, self.other_branch],
        }

    async def __call__(self, name, args, memory):
        self.calls.append((name, args))
        if name == "find_doctors":
            return [self.doctor]
        if name == "get_availability":
            if not self.slots:
                return {"timezone": "Asia/Kolkata", "slots": []}
            return {"timezone": "Asia/Kolkata", "slots": [
                {"doctor_id": "doctor-1", "branch_id": "branch-1", "consultation_type": "in_person",
                 "starts_at": f"{args['start_date']}T09:00:00+05:30", "ends_at": f"{args['start_date']}T09:30:00+05:30"},
                {"doctor_id": "doctor-1", "branch_id": "branch-1", "consultation_type": "in_person",
                 "starts_at": f"{args['start_date']}T09:30:00+05:30", "ends_at": f"{args['start_date']}T10:00:00+05:30"},
            ]}
        if name == "create_slot_hold":
            return {"id": "hold-1", **args, "status": "active"}
        if name == "confirm_appointment":
            return {"id": "appt-1", "confirmation_code": "AVO-TEST123", "reservation": {"id": "hold-1"}}
        if name == "release_slot_hold":
            return {"released": True}
        raise AssertionError(name)


async def no_search(query, settings):
    raise AssertionError("booking must not search static knowledge")


async def no_capture(fields, text, memory):
    raise AssertionError("booking must not create a pending enquiry")


@pytest.mark.asyncio
async def test_broad_booking_request_starts_discovery_without_model_or_backend_call():
    llm, clinic, memory = NeverLLM(), Clinic(), {}
    result = await Agent(llm, no_search, no_capture, clinic).run(
        "I would like to book an appointment.", [], SETTINGS, memory)
    assert result["answer"] == "Certainly. Which department or specialty do you need?"
    assert result["metrics"]["workflow_stage"] == "specialty"
    assert result["metrics"]["tool_calls"] == []
    assert memory["workflow"]["active"] is True
    assert llm.calls == 0


@pytest.mark.asyncio
async def test_booking_accepts_date_before_branch_and_reaches_live_availability():
    llm, clinic, memory = NeverLLM(), Clinic(), {}
    agent = Agent(llm, no_search, no_capture, clinic)

    await agent.run("I want a cardiology appointment tomorrow.", [], SETTINGS, memory)
    assert memory["workflow"]["values"]["date"]["value"]
    result = await agent.run("Indiranagar", [], SETTINGS, memory)

    assert "9:00 AM" in result["answer"]
    assert result["metrics"]["workflow_stage"] == "slot"
    availability = next(args for name, args in clinic.calls if name == "get_availability")
    assert availability["doctor_id"] == "doctor-1"
    assert availability["branch_id"] == "branch-1"
    assert llm.calls == 0


@pytest.mark.asyncio
async def test_complete_multi_turn_booking_is_deterministic_and_confirmed_only_by_backend():
    llm, clinic, memory = NeverLLM(), Clinic(), {}
    agent = Agent(llm, no_search, no_capture, clinic)

    turns = [
        "I would like to book an appointment.",
        "Cardiology tomorrow",
        "Indiranagar",
        "the second one",
        "My name is Priya Shah",
        "9876543210",
        "Yes, please",
    ]
    answers = []
    for turn in turns:
        result = await agent.run(turn, [], SETTINGS, memory)
        answers.append(result["answer"])

    assert "specialty" in answers[0]
    assert "location" in answers[1]
    assert "9:30 AM" in answers[2]
    assert "name" in answers[3]
    assert "phone number" in answers[4]
    assert "Please confirm" in answers[5]
    assert "AVO-TEST123" in answers[6]
    assert [name for name, _ in clinic.calls] == [
        "find_doctors", "get_availability", "create_slot_hold", "confirm_appointment",
    ]
    assert memory["workflow"]["active"] is False
    assert llm.calls == 0


@pytest.mark.asyncio
async def test_okay_confirms_instead_of_being_mistaken_for_a_goodbye():
    llm, clinic, memory = NeverLLM(), Clinic(), {}
    agent = Agent(llm, no_search, no_capture, clinic)
    for turn in (
        "Book cardiology tomorrow", "Indiranagar", "first",
        "My name is Priya Shah", "9876543210",
    ):
        await agent.run(turn, [], SETTINGS, memory)

    result = await agent.run("Okay", [], SETTINGS, memory)

    assert result["answer"] == "Your appointment is confirmed. Your confirmation code is AVO-TEST123."
    assert clinic.calls[-1][0] == "confirm_appointment"


@pytest.mark.asyncio
async def test_new_booking_does_not_reuse_a_completed_booking_state():
    llm, clinic, memory = NeverLLM(), Clinic(), {}
    agent = Agent(llm, no_search, no_capture, clinic)
    for turn in (
        "Book cardiology tomorrow", "Indiranagar", "first",
        "My name is Priya Shah", "9876543210", "Yes",
    ):
        await agent.run(turn, [], SETTINGS, memory)

    result = await agent.run("I want to book another appointment", [], SETTINGS, memory)

    assert result["answer"] == "Certainly. Which department or specialty do you need?"
    assert memory["workflow"]["active"] is True
    assert memory["workflow"]["values"] == {}


@pytest.mark.asyncio
async def test_no_availability_asks_for_another_date_without_claiming_backend_failure():
    llm, clinic, memory = NeverLLM(), Clinic(slots=False), {}
    agent = Agent(llm, no_search, no_capture, clinic)
    await agent.run("Book a cardiology appointment tomorrow", [], SETTINGS, memory)
    result = await agent.run("Indiranagar", [], SETTINGS, memory)
    assert "no open appointments" in result["answer"].lower()
    assert "other date" in result["answer"].lower()
    assert result["metrics"]["workflow_stage"] == "slot"
    assert "date" not in memory["workflow"]["values"]


@pytest.mark.asyncio
async def test_single_available_slot_asks_about_that_slot_and_accepts_yes():
    llm, clinic, memory = NeverLLM(), Clinic(), {}

    async def one_slot(name, args, booking_memory):
        result = await clinic(name, args, booking_memory)
        if name == "get_availability":
            result["slots"] = result["slots"][:1]
        return result

    agent = Agent(llm, no_search, no_capture, one_slot)
    await agent.run("Book cardiology tomorrow", [], SETTINGS, memory)
    result = await agent.run("Indiranagar", [], SETTINGS, memory)
    assert result["answer"] == "The only available time is 9:00 AM. Would you like that time?"

    accepted = await agent.run("Yes", [], SETTINGS, memory)
    assert "name" in accepted["answer"].lower()
    assert clinic.calls[-1][0] == "create_slot_hold"


@pytest.mark.asyncio
async def test_slot_pagination_reaches_every_backend_slot_and_uses_page_relative_choice():
    llm, clinic, memory = NeverLLM(), Clinic(), {}

    async def many_slots(name, args, booking_memory):
        if name == "get_availability":
            clinic.calls.append((name, args))
            times = ((9, 0), (9, 30), (10, 0), (10, 30), (11, 0), (11, 30))
            return {"timezone": "Asia/Kolkata", "slots": [{
                "doctor_id": "doctor-1", "branch_id": "branch-1", "consultation_type": "in_person",
                "starts_at": f"{args['start_date']}T{hour:02d}:{minute:02d}:00+05:30",
                "ends_at": f"{args['start_date']}T{hour:02d}:{minute + 30:02d}:00+05:30",
            } for hour, minute in times]}
        return await clinic(name, args, booking_memory)

    agent = Agent(llm, no_search, no_capture, many_slots)
    await agent.run("Book cardiology tomorrow", [], SETTINGS, memory)
    first_page = await agent.run("Indiranagar", [], SETTINGS, memory)
    second_page = await agent.run("more", [], SETTINGS, memory)
    selected = await agent.run("second", [], SETTINGS, memory)

    assert "Say more for later times" in first_page["answer"]
    assert "11:00 AM" in second_page["answer"] and "11:30 AM" in second_page["answer"]
    hold = next(args for name, args in reversed(clinic.calls) if name == "create_slot_hold")
    assert "T11:30:00" in hold["starts_at"]
    assert "name" in selected["answer"].lower()


@pytest.mark.asyncio
async def test_doctor_without_a_branch_never_produces_an_empty_location_question():
    llm, clinic, memory = NeverLLM(), Clinic(), {}
    clinic.doctor["branches"] = []
    result = await Agent(llm, no_search, no_capture, clinic).run(
        "Book a cardiology appointment", [], SETTINGS, memory)

    assert "no bookable clinic location" in result["answer"].lower()
    assert "location works for you:" not in result["answer"].lower()


@pytest.mark.asyncio
async def test_virtual_booking_uses_virtual_backend_availability_and_hold():
    llm, clinic, memory = NeverLLM(), Clinic(), {}
    clinic.doctor["branches"] = [clinic.branch]
    agent = Agent(llm, no_search, no_capture, clinic)

    first = await agent.run("Book a virtual cardiology appointment tomorrow", [], SETTINGS, memory)
    assert "continue with Dr. Vikram Rao" in first["answer"]
    await agent.run("Yes", [], SETTINGS, memory)
    await agent.run("first", [], SETTINGS, memory)

    availability = next(args for name, args in clinic.calls if name == "get_availability")
    hold = next(args for name, args in clinic.calls if name == "create_slot_hold")
    assert availability["consultation_type"] == "virtual"
    assert hold["consultation_type"] == "virtual"


@pytest.mark.asyncio
async def test_switching_from_unavailable_virtual_does_not_silently_accept_location():
    llm, clinic, memory = NeverLLM(), Clinic(), {}
    clinic.doctor["accepts_virtual"] = False
    clinic.doctor["virtual_branches"] = []
    clinic.doctor["in_person_branches"] = [clinic.branch]
    agent = Agent(llm, no_search, no_capture, clinic)

    first = await agent.run("Book a virtual cardiology appointment tomorrow", [], SETTINGS, memory)
    assert "in-person appointment instead" in first["answer"]

    switched = await agent.run("Yes", [], SETTINGS, memory)
    assert switched["answer"] == (
        "Dr. Vikram Rao currently has appointments at Indiranagar. "
        "Would you like that location?"
    )
    assert "branch" not in memory["workflow"]["values"]

    accepted_location = await agent.run("Yes", [], SETTINGS, memory)
    assert "available times" in accepted_location["answer"]
    assert memory["workflow"]["values"]["branch"]["value"] == "branch-1"


@pytest.mark.asyncio
async def test_cancelling_releases_an_active_hold():
    llm, clinic, memory = NeverLLM(), Clinic(), {}
    agent = Agent(llm, no_search, no_capture, clinic)
    for turn in ("Book cardiology tomorrow", "Indiranagar", "first"):
        await agent.run(turn, [], SETTINGS, memory)
    result = await agent.run("never mind", [], SETTINGS, memory)
    assert "stopped" in result["answer"]
    assert clinic.calls[-1][0] == "release_slot_hold"
    assert memory["workflow"]["active"] is False


@pytest.mark.asyncio
async def test_plain_cancel_is_always_a_workflow_command_not_a_knowledge_query():
    clinic, memory = Clinic(), {}
    agent = Agent(NeverLLM(), no_search, no_capture, clinic)
    for turn in ("Book cardiology tomorrow", "Indiranagar", "first"):
        await agent.run(turn, [], SETTINGS, memory)

    result = await agent.run("cancel", [], SETTINGS, memory)

    assert "stopped" in result["answer"]
    assert clinic.calls[-1][0] == "release_slot_hold"
    assert memory["workflow"]["active"] is False


@pytest.mark.asyncio
async def test_changing_a_selected_slot_releases_old_hold_and_keeps_discovery_consistent():
    llm, clinic, memory = NeverLLM(), Clinic(), {}
    agent = Agent(llm, no_search, no_capture, clinic)
    for turn in ("Book cardiology tomorrow", "Indiranagar", "second"):
        await agent.run(turn, [], SETTINGS, memory)
    result = await agent.run("Actually, use the first time instead", [], SETTINGS, memory)
    recent = [name for name, _ in clinic.calls[-2:]]
    assert recent == ["release_slot_hold", "create_slot_hold"]
    assert "name" in result["answer"]
    assert memory["workflow"]["values"]["slot"]["label"] == "9:00 AM"


def test_date_parser_understands_common_patient_phrasing():
    today = date(2026, 9, 28)
    assert _parse_date("tomorrow", today) == date(2026, 9, 29)
    assert _parse_date("tommorow", today) == date(2026, 9, 29)
    assert _parse_date("tomorow", today) == date(2026, 9, 29)
    assert _parse_date("tmrw", today) == date(2026, 9, 29)
    assert _parse_date("this Friday", today) == date(2026, 10, 2)
    assert _parse_date("October 5", today) == date(2026, 10, 5)
    assert _parse_date("5th October", today) == date(2026, 10, 5)
    assert _parse_date("05/10/2026", today) == date(2026, 10, 5)


@pytest.mark.asyncio
async def test_common_tomorrow_misspelling_advances_an_active_booking():
    llm, clinic, memory = NeverLLM(), Clinic(), {}
    agent = Agent(llm, no_search, no_capture, clinic)
    await agent.run("Book a cardiology appointment", [], SETTINGS, memory)
    await agent.run("Indiranagar", [], SETTINGS, memory)
    result = await agent.run("tommorow", [], SETTINGS, memory)
    assert result["metrics"]["workflow_stage"] == "slot"
    assert "9:00 AM" in result["answer"]
    assert memory["workflow"]["values"]["date"]["value"]


@pytest.mark.asyncio
async def test_uncertain_description_uses_llm_routing_then_requires_user_confirmation():
    llm, clinic, memory = NeverLLM(), Clinic(), {}
    classifications = []

    async def classify(messages, schema, max_tokens, settings):
        classifications.append(messages[-1]["content"])
        return {
            "specialty": "orthopedics",
            "confidence": 0.82,
            "reason": "Orthopedics may be a suitable starting point for leg pain.",
            "clarifying_question": "",
        }, {"llm_ms": 25, "tokens": 12, "tokens_per_second": 20}

    agent = Agent(llm, no_search, no_capture, clinic, classify)
    await agent.run("I would like to book an appointment", [], SETTINGS, memory)
    suggestion = await agent.run("I have leg pain", [], SETTINGS, memory)
    assert classifications == ["I have leg pain"]
    assert "Orthopedics" in suggestion["answer"]
    assert "not a diagnosis" in suggestion["answer"]
    assert suggestion["metrics"]["tool_calls"] == ["infer_specialty"]
    assert suggestion["metrics"]["llm_ms"] == 25
    assert "specialty" not in memory["workflow"]["values"]

    confirmed = await agent.run("Yes", [], SETTINGS, memory)
    assert memory["workflow"]["values"]["specialty"]["value"] == "orthopedics"
    assert memory["workflow"]["values"]["specialty"]["source"] == "llm_suggestion_confirmed_by_user"
    assert "location" in confirmed["answer"]
    assert clinic.calls[0] == ("find_doctors", {"department": "orthopedics"})


@pytest.mark.asyncio
async def test_doctor_price_question_uses_cached_backend_options_without_losing_booking_state():
    clinic, memory = Clinic(), {}
    clinic.doctor["branches"] = [clinic.branch]
    second = {
        **clinic.doctor,
        "id": "doctor-2",
        "name": "Dr. Radhika Iyer",
        "title": "Consultant Physician",
        "fee_inr": 900,
    }

    async def operate(name, args, booking_memory):
        if name == "find_doctors":
            clinic.calls.append((name, args))
            if sum(1 for call_name, _ in clinic.calls if call_name == "find_doctors") == 1:
                return [clinic.doctor, second]
            return [{**clinic.doctor, "fee_inr": 1300}, {**second, "fee_inr": 1000}]
        return await clinic(name, args, booking_memory)

    agent = Agent(NeverLLM(), no_search, no_capture, operate)
    first = await agent.run("Book a cardiology appointment", [], SETTINGS, memory)
    assert "Dr. Vikram Rao" in first["answer"]
    assert "Dr. Radhika Iyer" in first["answer"]

    prices = await agent.run("What are their prices?", [], SETTINGS, memory)

    assert "Dr. Vikram Rao, 1,300 rupees" in prices["answer"]
    assert "Dr. Radhika Iyer, 1,000 rupees" in prices["answer"]
    assert prices["metrics"]["workflow_stage"] == "doctor"
    assert "doctor" not in memory["workflow"]["values"]
    assert [name for name, _ in clinic.calls].count("find_doctors") == 2

    selected = await agent.run("the second one", [], SETTINGS, memory)
    assert memory["workflow"]["values"]["doctor"]["value"] == "doctor-2"
    assert "location" in selected["answer"].lower()


@pytest.mark.asyncio
async def test_single_doctor_fee_question_never_asks_which_doctor():
    clinic, memory = Clinic(), {}
    result = await Agent(NeverLLM(), no_search, no_capture, clinic).run(
        "Book a cardiology appointment. What is the fee?", [], SETTINGS, memory)

    assert "1,200 rupees" in result["answer"]
    assert "which doctor" not in result["answer"].lower()
    assert "continue with Dr. Vikram Rao" in result["answer"]


@pytest.mark.asyncio
async def test_date_number_is_not_mistaken_for_a_doctor_choice():
    clinic, memory = Clinic(), {}
    doctors = [{**clinic.doctor, "id": f"doctor-{index}", "name": f"Doctor {index}"}
               for index in range(1, 6)]

    async def operate(name, args, booking_memory):
        if name == "find_doctors":
            return doctors
        return await clinic(name, args, booking_memory)

    result = await Agent(NeverLLM(), no_search, no_capture, operate).run(
        "Book cardiology on October 5", [], SETTINGS, memory)

    assert "Which doctor" in result["answer"]
    assert "doctor" not in memory["workflow"]["values"]


@pytest.mark.asyncio
async def test_non_name_answer_is_not_saved_as_the_patient_name():
    llm, clinic, memory = NeverLLM(), Clinic(), {}
    agent = Agent(llm, no_search, no_capture, clinic)
    for turn in ("Book cardiology tomorrow", "Indiranagar", "first"):
        await agent.run(turn, [], SETTINGS, memory)

    result = await agent.run("I don't know", [], SETTINGS, memory)

    assert result["answer"] == "What name should I use for the appointment?"
    assert "patient_name" not in memory["workflow"]["values"]


@pytest.mark.asyncio
async def test_single_backend_location_requires_user_confirmation():
    clinic, memory = Clinic(), {}
    clinic.doctor["branches"] = [clinic.branch]
    agent = Agent(NeverLLM(), no_search, no_capture, clinic)

    result = await agent.run("Book cardiology tomorrow", [], SETTINGS, memory)

    assert result["answer"] == (
        "Dr. Vikram Rao currently has appointments at Indiranagar. Would you like that location?"
    )
    assert "branch" not in memory["workflow"]["values"]

    accepted = await agent.run("Yes", [], SETTINGS, memory)
    assert memory["workflow"]["values"]["branch"]["label"] == "Indiranagar"
    assert "9:00 AM" in accepted["answer"]


@pytest.mark.asyncio
async def test_location_correction_clears_downstream_patient_data_before_rebooking():
    clinic, memory = Clinic(), {}
    agent = Agent(NeverLLM(), no_search, no_capture, clinic)
    for turn in ("Book cardiology tomorrow", "Indiranagar", "first", "Priya Shah", "9999999999"):
        result = await agent.run(turn, [], SETTINGS, memory)
    assert "Please confirm" in result["answer"]

    corrected = await agent.run("I want it in white field", [], SETTINGS, memory)

    values = memory["workflow"]["values"]
    assert values["branch"]["label"] == "Whitefield"
    assert "slot" not in values
    assert "patient_name" not in values
    assert "patient_phone" not in values
    assert "I Want It In White Field" not in str(values)
    assert "9:00 AM" in corrected["answer"]
    assert [name for name, _ in clinic.calls[-2:]] == ["release_slot_hold", "get_availability"]
    assert corrected["metrics"]["workflow_stage"] == "slot"


@pytest.mark.asyncio
async def test_unsupported_location_and_conversation_phrases_never_become_patient_name():
    clinic, memory = Clinic(), {}
    clinic.doctor["branches"] = [clinic.branch]
    agent = Agent(NeverLLM(), no_search, no_capture, clinic)
    for turn in ("Book cardiology tomorrow", "Yes", "first"):
        result = await agent.run(turn, [], SETTINGS, memory)
    assert result["answer"] == "What name should I use for the appointment?"

    casual = await agent.run("That's cool", [], SETTINGS, memory)
    assert casual["answer"] == "What name should I use for the appointment?"
    assert "patient_name" not in memory["workflow"]["values"]

    unsupported = await agent.run("I want it in white field", [], SETTINGS, memory)
    assert "no active schedule at Whitefield" in unsupported["answer"]
    assert "patient_name" not in memory["workflow"]["values"]

    retained = await agent.run("Yes", [], SETTINGS, memory)
    assert "What name should I use" in retained["answer"]
    named = await agent.run("My name is Priya Shah", [], SETTINGS, memory)
    assert named["answer"] == "What phone number should the hospital use for this appointment?"
    assert memory["workflow"]["values"]["patient_name"]["value"] == "Priya Shah"


@pytest.mark.asyncio
async def test_yes_after_unavailable_location_does_not_confirm_booking():
    clinic, memory = Clinic(), {}
    clinic.doctor["branches"] = [clinic.branch]
    agent = Agent(NeverLLM(), no_search, no_capture, clinic)
    for turn in ("Book cardiology tomorrow", "Yes", "second", "Priya Shah", "9999999999"):
        result = await agent.run(turn, [], SETTINGS, memory)
    assert "Please confirm" in result["answer"]

    unavailable = await agent.run("I want Whitefield", [], SETTINGS, memory)
    assert "no active schedule at Whitefield" in unavailable["answer"]

    kept = await agent.run("Yes", [], SETTINGS, memory)
    assert "Okay, keeping Indiranagar" in kept["answer"]
    assert "Please confirm" in kept["answer"]
    assert not any(name == "confirm_appointment" for name, _ in clinic.calls)

    confirmed = await agent.run("Yes", [], SETTINGS, memory)
    assert "AVO-TEST123" in confirmed["answer"]
    assert [name for name, _ in clinic.calls].count("confirm_appointment") == 1


@pytest.mark.asyncio
async def test_red_flag_language_bypasses_llm_and_booking_discovery():
    clinic, memory = Clinic(), {}
    classifications = []

    async def classify(*args, **kwargs):
        classifications.append(True)
        return {}, {}

    agent = Agent(NeverLLM(), no_search, no_capture, clinic, classify)
    await agent.run("I need to book an appointment", [], SETTINGS, memory)
    result = await agent.run("I have chest pain and difficulty breathing", [], SETTINGS, memory)
    assert "emergency services" in result["answer"].lower()
    assert classifications == []
    assert clinic.calls == []


@pytest.mark.asyncio
async def test_uncertain_non_emergency_symptom_falls_back_to_general_medicine():
    clinic, memory = Clinic(), {}

    async def classify(messages, schema, max_tokens, settings):
        return {
            "specialty": "unknown", "confidence": 0.2, "reason": "",
            "clarifying_question": "Can you describe it further?",
        }, {"llm_ms": 10, "tokens": 4, "tokens_per_second": 10}

    agent = Agent(NeverLLM(), no_search, no_capture, clinic, classify)
    await agent.run("I need an appointment", [], SETTINGS, memory)
    result = await agent.run("I have leg pain", [], SETTINGS, memory)
    assert "General Medicine" in result["answer"]
    assert "not a diagnosis" in result["answer"]
    assert memory["workflow"]["pending_specialty"]["specialty"] == "general medicine"


@pytest.mark.asyncio
async def test_broken_llm_classifier_does_not_break_booking_workflow():
    clinic, memory = Clinic(), {}

    async def broken_classifier(*args, **kwargs):
        raise ValueError("malformed JSON")

    agent = Agent(NeverLLM(), no_search, no_capture, clinic, broken_classifier)
    await agent.run("I need an appointment", [], SETTINGS, memory)
    result = await agent.run("I have leg pain", [], SETTINGS, memory)
    assert "General Medicine" in result["answer"]
    assert result["metrics"]["fallback"] == "booking_workflow"
    assert result["metrics"]["tool_calls"] == ["infer_specialty"]


def test_workflow_steps_are_registry_driven_and_replaceable():
    engine = WorkflowEngine()
    original = engine.definitions["booking"]
    assert [step.key for step in original] == [
        "specialty", "doctor", "branch", "date", "slot", "patient_name", "patient_phone", "confirmation"
    ]
    replacement_date = DateStep(today=lambda: date(2030, 1, 1))
    engine.definitions["booking"] = [step for step in original if step.key != "date"]
    engine.definitions["booking"].insert(3, replacement_date)
    assert engine.definitions["booking"][3] is replacement_date
