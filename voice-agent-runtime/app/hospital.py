"""Typed gateway to the clinic Core API. This service never writes clinic tables directly."""
import uuid
from datetime import date, timedelta

import httpx

from .config import HOSPITAL_API_URL, HOSPITAL_SERVICE_KEY


DEPARTMENT_API_VALUES = {
    'general medicine': 'general-medicine',
    'primary care': 'general-medicine',
}


class HospitalAPIError(RuntimeError):
    pass


class HospitalClient:
    def __init__(self, session_id: str, base_url: str = HOSPITAL_API_URL,
                 service_key: str = HOSPITAL_SERVICE_KEY, transport=None):
        self.session_id = session_id
        self.owner_key = f"voice:{session_id}"
        self.base_url = base_url
        self.headers = {'X-Service-Key': service_key}
        self.transport = transport

    async def _request(self, method, path, **kwargs):
        async with httpx.AsyncClient(base_url=self.base_url, headers=self.headers,
                                     timeout=12, transport=self.transport) as client:
            response = await client.request(method, path, **kwargs)
        if response.status_code >= 400:
            try:
                detail = response.json().get('error', {}).get('message') or response.json().get('detail')
            except Exception:
                detail = None
            raise HospitalAPIError(detail or f"Hospital API returned {response.status_code}.")
        return None if response.status_code == 204 else response.json()

    @staticmethod
    def _idempotency_key(memory, operation, signature):
        """Reuse a key when an operation is retried after an uncertain network result."""
        keys = memory.setdefault('_hospital_idempotency', {})
        existing = keys.get(operation) or {}
        if existing.get('signature') != signature:
            existing = {'signature': signature, 'key': f"voice-{operation}-{uuid.uuid4().hex}"}
            keys[operation] = existing
        return existing['key']

    async def start_session(self):
        return await self._request('POST', '/api/v1/integrations/voice/sessions',
                                   json={'runtime_session_id': self.session_id, 'channel': 'web_voice'})

    async def health(self):
        data = await self._request('GET', '/api/health/ready')
        return bool(
            data and data.get('ready')
            and data.get('service') == 'exora-hospital-backend'
            and data.get('api_version') == 'v1'
        )

    async def end_session(self, status='completed'):
        return await self._request('PATCH', f'/api/v1/integrations/voice/sessions/{self.session_id}',
                                   json={'status': status})

    async def event(self, tool_name, outcome='success', appointment_id=None, kind='tool'):
        payload = {'tool_name': tool_name, 'outcome': outcome, 'intent': tool_name, 'kind': kind}
        if appointment_id:
            payload['appointment_id'] = appointment_id
        return await self._request('POST', f'/api/v1/integrations/voice/sessions/{self.session_id}/events',
                                   json=payload)

    async def operate(self, name: str, args: dict, memory: dict):
        if name == 'find_doctors':
            params = {key: args[key] for key in ('department', 'branch') if args.get(key)}
            if params.get('department'):
                normalized = params['department'].strip().casefold()
                params['department'] = DEPARTMENT_API_VALUES.get(normalized, params['department'])
            doctors = await self._request('GET', '/api/v1/integrations/voice/doctors', params=params)
            if not isinstance(doctors, list):
                raise HospitalAPIError('The hospital doctor directory returned an invalid response.')
            return [{
                'id': item['id'], 'name': item['name'], 'title': item['title'],
                'fee_inr': item['consultation_fee'], 'accepts_virtual': item['accepts_virtual'],
                'departments': [value['name'] for value in item['departments']],
                'branches': [{'id': value['id'], 'name': value['name'], 'area': value['area']}
                             for value in item.get('in_person_branches', item['branches'])],
                'in_person_branches': [
                    {'id': value['id'], 'name': value['name'], 'area': value['area']}
                    for value in item.get('in_person_branches', item['branches'])
                ],
                'virtual_branches': [
                    {'id': value['id'], 'name': value['name'], 'area': value['area']}
                    for value in item.get('virtual_branches', [])
                ],
            } for item in doctors]
        if name == 'get_availability':
            start = args.get('start_date') or date.today().isoformat()
            end = args.get('end_date') or start
            data = await self._request('GET', '/api/v1/integrations/voice/availability', params={
                'doctor_id': args['doctor_id'], 'branch_id': args['branch_id'],
                'start_date': start, 'end_date': end,
                'consultation_type': args.get('consultation_type', 'in_person'),
            })
            if not isinstance(data, dict) or not isinstance(data.get('slots'), list):
                raise HospitalAPIError('The hospital availability service returned an invalid response.')
            return {'timezone': data['timezone'], 'slots': data['slots']}
        if name == 'create_slot_hold':
            signature = '|'.join(str(args.get(key) or '') for key in (
                'doctor_id', 'branch_id', 'consultation_type', 'starts_at', 'ends_at'))
            payload = {
                'doctor_id': args['doctor_id'], 'branch_id': args['branch_id'],
                'consultation_type': args.get('consultation_type', 'in_person'),
                'starts_at': args['starts_at'], 'ends_at': args['ends_at'],
                'owner_key': self.owner_key,
                'idempotency_key': self._idempotency_key(memory, 'hold', signature),
            }
            hold = await self._request('POST', '/api/v1/integrations/voice/slot-holds', json=payload)
            if not isinstance(hold, dict) or not hold.get('id'):
                raise HospitalAPIError('The hospital did not return a valid slot hold.')
            memory['current_hold'] = hold
            return hold
        if name == 'confirm_appointment':
            hold_id = args.get('hold_id') or (memory.get('current_hold') or {}).get('id')
            if not hold_id:
                raise HospitalAPIError('There is no active slot hold to confirm.')
            payload = {
                'hold_id': hold_id, 'owner_key': self.owner_key,
                'patient_name': args['patient_name'], 'patient_phone': args['patient_phone'],
                'patient_email': args.get('patient_email') or None, 'reason': args.get('reason') or None,
                'origin_channel': 'voice',
                'idempotency_key': self._idempotency_key(memory, 'booking', str(hold_id)),
            }
            appointment = await self._request('POST', '/api/v1/integrations/voice/appointments', json=payload)
            if not isinstance(appointment, dict) or not appointment.get('confirmation_code'):
                raise HospitalAPIError('The hospital did not return an appointment confirmation code.')
            memory['appointment'] = appointment
            memory.pop('current_hold', None)
            memory.get('_hospital_idempotency', {}).pop('hold', None)
            return appointment
        if name == 'release_slot_hold':
            hold_id = args.get('hold_id') or (memory.get('current_hold') or {}).get('id')
            if not hold_id:
                return {'released': False, 'message': 'No active hold.'}
            await self._request('DELETE', f'/api/v1/integrations/voice/slot-holds/{hold_id}',
                                params={'owner_key': self.owner_key})
            memory.pop('current_hold', None)
            memory.get('_hospital_idempotency', {}).pop('hold', None)
            return {'released': True}
        raise HospitalAPIError(f'Unsupported hospital operation: {name}')
