// Registered event consumers. They live with their modules in the API app; the worker runs them.
// Still to come: comms (confirmations, reminders, sending teleconsult links), billing (charges on encounter.*).
import { consumers } from '../../api/src/consumers.ts';
import type { EventHandler } from './dispatcher.ts';

export const handlers: EventHandler[] = consumers;
