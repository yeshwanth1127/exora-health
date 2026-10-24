export type ClinicModule = 'inpatient' | 'billing' | 'inventory' | 'pharmacy' | 'hr';
export const CLINIC_MODULES: ClinicModule[];
export function parseClinicModules(value: unknown): ClinicModule[];
export function toggleClinicModule(value: ClinicModule[] | undefined, code: ClinicModule, selected: boolean): ClinicModule[];
export function entitledModules(plan: string, value?: ClinicModule[]): string[];
