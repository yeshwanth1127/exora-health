import { z } from 'zod';

export const E164PhoneNumber = z.string().regex(/^\+[1-9]\d{7,14}$/);

export type TelephonyEndpoint = {
  connectionId: string;
  phoneNumber: string;
  active: boolean;
};

export type TelephonyDeployment = {
  deploymentId: string;
  phoneNumbers: string[];
  status: 'active' | 'paused';
};

/**
 * Deterministically picks one active, unassigned endpoint. The provider adapter must perform the
 * final reserve/create step under its own lock because its inventory is authoritative.
 */
export function chooseDedicatedNumber(
  endpoints: TelephonyEndpoint[],
  deployments: TelephonyDeployment[],
  locallyReserved: string[] = [],
  preferredConnectionId?: string,
): TelephonyEndpoint | null {
  const unavailable = new Set([
    ...locallyReserved.map((number) => E164PhoneNumber.parse(number)),
    ...deployments.flatMap((deployment) => deployment.phoneNumbers.map((number) => E164PhoneNumber.parse(number))),
  ]);
  const candidates = endpoints
    .map((endpoint) => ({ ...endpoint, phoneNumber: E164PhoneNumber.parse(endpoint.phoneNumber) }))
    .filter((endpoint) => endpoint.active && !unavailable.has(endpoint.phoneNumber))
    .sort((a, b) => {
      const preferredA = a.connectionId === preferredConnectionId ? 0 : 1;
      const preferredB = b.connectionId === preferredConnectionId ? 0 : 1;
      return preferredA - preferredB || a.connectionId.localeCompare(b.connectionId) || a.phoneNumber.localeCompare(b.phoneNumber);
    });
  return candidates[0] ?? null;
}

export type ManagedTelephonyRequest = {
  mode: 'dedicated_managed_number';
  required: true;
  allocationKey: string;
  preferredConnectionId: string | null;
  existing: {
    connectionId: string | null;
    phoneNumber: string | null;
    deploymentId: string | null;
  };
  inbound: {
    timezone: string;
    alwaysOpen: true;
  };
};

export function managedTelephonyRequest(input: {
  customerId: string;
  timezone: string;
  preferredConnectionId?: string;
  connectionId?: string | null;
  phoneNumber?: string | null;
  deploymentId?: string | null;
}): ManagedTelephonyRequest {
  return {
    mode: 'dedicated_managed_number',
    required: true,
    allocationKey: `tenant:${input.customerId}`,
    preferredConnectionId: input.preferredConnectionId?.trim() || null,
    existing: {
      connectionId: input.connectionId ?? null,
      phoneNumber: input.phoneNumber ? E164PhoneNumber.parse(input.phoneNumber) : null,
      deploymentId: input.deploymentId ?? null,
    },
    inbound: { timezone: input.timezone, alwaysOpen: true },
  };
}
