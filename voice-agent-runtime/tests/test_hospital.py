import json

import httpx
import pytest

from app.hospital import HospitalClient


@pytest.mark.asyncio
async def test_hospital_health_accepts_only_the_exora_backend_identity():
    payload = {'ready': True, 'service': 'exora-hospital-backend', 'api_version': 'v1'}

    def handler(request: httpx.Request):
        return httpx.Response(200, json=payload)

    client = HospitalClient('health-check', base_url='http://hospital.test',
                            service_key='test-key', transport=httpx.MockTransport(handler))
    assert await client.health() is True

    payload['service'] = 'some-other-service'
    assert await client.health() is False


@pytest.mark.asyncio
async def test_hospital_client_translates_patient_friendly_department_name_to_api_slug():
    seen = {}

    def handler(request: httpx.Request):
        seen.update(dict(request.url.params))
        return httpx.Response(200, json=[])

    client = HospitalClient('session-12345678', base_url='http://hospital.test',
                            service_key='test-key', transport=httpx.MockTransport(handler))
    await client.operate('find_doctors', {'department': 'general medicine'}, {})
    assert seen['department'] == 'general-medicine'


@pytest.mark.asyncio
async def test_hospital_client_uses_core_api_for_hold_and_booking():
    requests = []

    def handler(request: httpx.Request):
        requests.append(request)
        body = json.loads(request.content or b'{}')
        if request.url.path.endswith('/slot-holds'):
            assert body['owner_key'] == 'voice:session-12345678'
            return httpx.Response(201, json={'id': 'hold-1', **body, 'status': 'active', 'expires_at': '2026-10-01T10:07:00Z'})
        if request.url.path.endswith('/appointments'):
            assert body['hold_id'] == 'hold-1'
            assert body['origin_channel'] == 'voice'
            return httpx.Response(201, json={'id': 'appointment-1', 'confirmation_code': 'AVO-1234ABCD'})
        return httpx.Response(404, json={'error': {'message': 'Unexpected request'}})

    client = HospitalClient('session-12345678', base_url='http://hospital.test',
                            service_key='test-key', transport=httpx.MockTransport(handler))
    memory = {}
    hold = await client.operate('create_slot_hold', {
        'doctor_id': 'doctor-1', 'branch_id': 'branch-1',
        'starts_at': '2026-10-01T10:00:00Z', 'ends_at': '2026-10-01T10:30:00Z',
    }, memory)
    booking = await client.operate('confirm_appointment', {
        'patient_name': 'Test Patient', 'patient_phone': '+919999999999',
    }, memory)

    assert hold['id'] == 'hold-1'
    assert booking['confirmation_code'] == 'AVO-1234ABCD'
    assert 'current_hold' not in memory
    assert memory['appointment']['id'] == 'appointment-1'
    assert all(request.headers['X-Service-Key'] == 'test-key' for request in requests)


@pytest.mark.asyncio
async def test_hospital_reuses_idempotency_keys_for_safe_retries():
    requests = []

    def handler(request: httpx.Request):
        body = json.loads(request.content or b'{}')
        requests.append((request.url.path, body))
        if request.url.path.endswith('/slot-holds'):
            return httpx.Response(201, json={'id': 'hold-1', **body})
        if request.url.path.endswith('/appointments'):
            return httpx.Response(201, json={'id': 'appointment-1', 'confirmation_code': 'AVO-RETRY'})
        return httpx.Response(404)

    client = HospitalClient('session-retry', base_url='http://hospital.test',
                            service_key='test-key', transport=httpx.MockTransport(handler))
    memory = {}
    hold_args = {
        'doctor_id': 'doctor-1', 'branch_id': 'branch-1',
        'starts_at': '2026-10-01T10:00:00Z', 'ends_at': '2026-10-01T10:30:00Z',
    }
    await client.operate('create_slot_hold', hold_args, memory)
    await client.operate('create_slot_hold', hold_args, memory)
    await client.operate('confirm_appointment', {'patient_name': 'Priya', 'patient_phone': '9999999999'}, memory)
    memory['current_hold'] = {'id': 'hold-1'}
    await client.operate('confirm_appointment', {'patient_name': 'Priya', 'patient_phone': '9999999999'}, memory)

    hold_keys = [body['idempotency_key'] for path, body in requests if path.endswith('/slot-holds')]
    booking_keys = [body['idempotency_key'] for path, body in requests if path.endswith('/appointments')]
    assert len(set(hold_keys)) == 1
    assert len(set(booking_keys)) == 1


@pytest.mark.asyncio
async def test_hospital_client_does_not_truncate_doctors_or_slots():
    doctors = [{
        'id': f'doctor-{index}', 'name': f'Doctor {index}', 'title': 'Consultant',
        'consultation_fee': 1000, 'accepts_virtual': True,
        'departments': [{'name': 'Cardiology'}],
        'branches': [{'id': 'branch-1', 'name': 'Clinic', 'area': 'Central'}],
    } for index in range(15)]
    slots = [{
        'starts_at': f'2026-10-01T{hour:02d}:00:00+05:30',
        'ends_at': f'2026-10-01T{hour:02d}:30:00+05:30',
    } for hour in range(24)]

    def handler(request: httpx.Request):
        if request.url.path.endswith('/doctors'):
            return httpx.Response(200, json=doctors)
        if request.url.path.endswith('/availability'):
            return httpx.Response(200, json={'timezone': 'Asia/Kolkata', 'slots': slots})
        return httpx.Response(404)

    client = HospitalClient('session-all', base_url='http://hospital.test',
                            service_key='test-key', transport=httpx.MockTransport(handler))
    found = await client.operate('find_doctors', {}, {})
    available = await client.operate('get_availability', {
        'doctor_id': 'doctor-1', 'branch_id': 'branch-1',
        'start_date': '2026-10-01', 'end_date': '2026-10-01',
    }, {})

    assert len(found) == 15
    assert len(available['slots']) == 24
