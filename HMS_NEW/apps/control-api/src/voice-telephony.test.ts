import { describe, expect, it } from 'vitest';
import { chooseDedicatedNumber, managedTelephonyRequest } from './voice-telephony.ts';

describe('managed Voice telephony', () => {
  it('never returns a number already used by a deployment or local reservation', () => {
    const result = chooseDedicatedNumber([
      { connectionId: 'b', phoneNumber: '+918000000001', active: true },
      { connectionId: 'a', phoneNumber: '+918000000002', active: true },
      { connectionId: 'a', phoneNumber: '+918000000003', active: true },
    ], [{ deploymentId: 'existing', phoneNumbers: ['+918000000001'], status: 'active' }], ['+918000000002']);
    expect(result).toEqual({ connectionId: 'a', phoneNumber: '+918000000003', active: true });
  });

  it('prefers the configured connection and returns null when inventory is exhausted', () => {
    const endpoints = [
      { connectionId: 'a', phoneNumber: '+918000000001', active: true },
      { connectionId: 'b', phoneNumber: '+918000000002', active: true },
    ];
    expect(chooseDedicatedNumber(endpoints, [], [], 'b')?.phoneNumber).toBe('+918000000002');
    expect(chooseDedicatedNumber(endpoints, [{ deploymentId: 'one', phoneNumbers: endpoints.map((item) => item.phoneNumber), status: 'active' }])).toBeNull();
  });

  it('builds an idempotent tenant allocation request and validates E.164', () => {
    expect(managedTelephonyRequest({ customerId: 'customer-a', timezone: 'Asia/Kolkata' })).toMatchObject({
      mode: 'dedicated_managed_number', required: true, allocationKey: 'tenant:customer-a',
      existing: { connectionId: null, phoneNumber: null, deploymentId: null },
    });
    expect(() => managedTelephonyRequest({ customerId: 'customer-a', timezone: 'Asia/Kolkata', phoneNumber: '8071580756' })).toThrow();
  });
});
