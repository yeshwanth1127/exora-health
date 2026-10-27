import {english,type Copy} from './en';
import hi from './hi.json';import ta from './ta.json';import te from './te.json';import bn from './bn.json';
import id from './id.json';import ms from './ms.json';import th from './th.json';import vi from './vi.json';
import fr from './fr.json';import de from './de.json';import es from './es.json';
import type {Locale} from './config';
export const messages:Record<Locale,Copy>={en:english,hi,ta,te,bn,id,ms,th,vi,fr,de,es};
export function getCopy(locale:Locale):Copy{return messages[locale];}
