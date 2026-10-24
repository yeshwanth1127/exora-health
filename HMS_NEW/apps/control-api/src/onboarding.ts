import { z } from 'zod';
import {parseClinicModules} from '../../../packages/platform/onboarding-modules.mjs';

export const Onboarding = z.object({
  organisation: z.string().trim().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  ownerName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(30).optional(),
  city: z.string().trim().min(2).max(80),
  timezone: z.string().trim().min(3).max(64).refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }, 'Choose a valid timezone.'),
  facilityName: z.string().trim().min(2).max(120),
  facilityType: z.enum(['clinic', 'hospital', 'diagnostic_centre', 'virtual']),
  plan: z.enum(['launch', 'connect', 'scale']),
  voice: z.boolean(),
  whatsapp: z.boolean(),
  websiteTemplate: z.enum(['standard', 'sri-lakshmi']).default('standard'),
  clinicModules: z.array(z.enum(['inpatient','billing','inventory','pharmacy','hr'])).max(5).optional().superRefine((value,ctx)=>{try{parseClinicModules(value);}catch(error){ctx.addIssue({code:'custom',message:(error as Error).message});}}),
  termsAccepted: z.literal(true),
}).refine((value) => !value.voice || value.plan !== 'launch', { path: ['voice'], message: 'Voice requires the Connect or Scale plan.' });
