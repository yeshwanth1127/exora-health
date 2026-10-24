import {test,expect} from 'vitest';
import {Onboarding} from './onboarding.ts';
import {entitledModules} from '../../../packages/platform/onboarding-modules.mjs';
const input={organisation:'Test Clinic',slug:'test-clinic',ownerName:'Test Owner',email:'owner@example.test',city:'Pune',timezone:'Asia/Kolkata',facilityName:'Test Clinic',facilityType:'clinic',plan:'connect',voice:false,whatsapp:false,termsAccepted:true};
test('selected module access is validated and keeps disabled modules out of entitlements',()=>{
 const parsed=Onboarding.parse({...input,clinicModules:['billing']});expect(parsed.clinicModules).toEqual(['billing']);expect(entitledModules(parsed.plan,parsed.clinicModules)).toContain('billing');expect(entitledModules(parsed.plan,parsed.clinicModules)).not.toContain('hr');
 expect(Onboarding.safeParse({...input,clinicModules:['inpatient']}).success).toBe(false);expect(Onboarding.safeParse({...input,clinicModules:['pharmacy']}).success).toBe(false);expect(Onboarding.safeParse({...input,clinicModules:['billing','billing']}).success).toBe(false);expect(Onboarding.safeParse({...input,clinicModules:['unknown']}).success).toBe(false);
 expect(Onboarding.parse({...input,clinicModules:[]}).clinicModules).toEqual([]);expect(Onboarding.parse(input).clinicModules).toBeUndefined();
});
