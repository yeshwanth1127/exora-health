// Registered event consumers. They live with their modules in the API app; the worker runs them.
// Communications currently persists notifications using a non-delivering log transport.
import { consumers } from '../../api/src/consumers.ts';
import type { EventHandler } from './dispatcher.ts';

export const handlers: EventHandler[] = consumers;
