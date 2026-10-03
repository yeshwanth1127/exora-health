from collections import deque

import pytest

from app.main import VoiceEndpoint


class EnergyVad:
    def is_speech(self, frame, sample_rate):
        assert sample_rate == 16000
        return any(frame)


def endpoint_harness():
    endpoint = VoiceEndpoint.__new__(VoiceEndpoint)
    endpoint.vad = EnergyVad()
    endpoint.buffer = bytearray()
    endpoint.pre_roll = deque(maxlen=15)
    endpoint.trigger = deque(maxlen=10)
    endpoint.noise_rms = deque(maxlen=50)
    endpoint.frames = []
    endpoint.speaking = False
    endpoint.silent = 0
    endpoint.input_enabled = True
    endpoint.settings = {'silence_ms': 40}
    endpoint.turn = None
    endpoint.started = []
    endpoint.events = []

    async def interrupt():
        endpoint.turn = f'turn-{len(endpoint.started) + 1}'

    async def send(kind, tid=None, **data):
        endpoint.events.append((kind, tid, data))

    async def start_turn(text=None, pcm=None, tid=None):
        endpoint.started.append((tid, pcm))

    endpoint.interrupt = interrupt
    endpoint.send = send
    endpoint.start_turn = start_turn
    return endpoint


@pytest.mark.asyncio
async def test_microphone_rearms_for_an_immediate_second_utterance():
    endpoint = endpoint_harness()
    speech = (1000).to_bytes(2, 'little', signed=True) * 320
    silence = b'\x00' * 640

    await endpoint.receive_audio(speech * 10 + silence * 2)
    assert endpoint.input_enabled is False
    endpoint.reset_audio_input()
    assert endpoint.input_enabled is True
    await endpoint.receive_audio(speech * 10 + silence * 2)

    assert len(endpoint.started) == 2
    assert [kind for kind, _, _ in endpoint.events] == [
        'speech_start', 'speech_end', 'speech_start', 'speech_end',
    ]
    assert all(len(pcm) >= len(speech) * 10 for _, pcm in endpoint.started)


@pytest.mark.asyncio
async def test_ambient_audio_cannot_cancel_a_turn_while_it_is_processing():
    endpoint = endpoint_harness()
    speech = (1000).to_bytes(2, 'little', signed=True) * 320
    silence = b'\x00' * 640

    await endpoint.receive_audio(speech * 10 + silence * 2)
    assert len(endpoint.started) == 1

    await endpoint.receive_audio(speech * 20 + silence * 20)

    assert len(endpoint.started) == 1
    assert [kind for kind, _, _ in endpoint.events] == ['speech_start', 'speech_end']


@pytest.mark.asyncio
async def test_failed_audit_event_does_not_turn_a_successful_booking_into_a_failure():
    class Hospital:
        async def operate(self, name, args, memory):
            return {'id': 'appointment-1', 'confirmation_code': 'AVO-SAFE'}

        async def event(self, *args, **kwargs):
            raise RuntimeError('audit service unavailable')

    endpoint = VoiceEndpoint.__new__(VoiceEndpoint)
    endpoint.hospital = Hospital()

    result = await endpoint._operate('confirm_appointment', {}, {})

    assert result['confirmation_code'] == 'AVO-SAFE'
