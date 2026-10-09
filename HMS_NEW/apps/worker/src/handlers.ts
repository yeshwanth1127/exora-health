// Registered event consumers. Real consumers arrive with their modules (e.g. comms sends booking
// confirmations on appointment.confirmed; clinical opens an encounter on appointment.checked_in).
// Until then the worker still delivers and records every event, so nothing piles up.
import type { EventHandler } from './dispatcher.ts';

export const handlers: EventHandler[] = [];
