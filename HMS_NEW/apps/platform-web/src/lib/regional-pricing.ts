/** Country is a pricing market, never inferred from a visitor's language. No FX conversion. */
export const countries=[
 ['IN','INR'],['SG','SGD'],['MY','MYR'],['ID','IDR'],['TH','THB'],['VN','VND'],['PH','PHP'],
 ['AU','AUD'],['NZ','NZD'],['US','USD'],['CA','CAD'],['GB','GBP'],['IE','EUR'],['FR','EUR'],['DE','EUR'],['ES','EUR'],['IT','EUR'],['NL','EUR'],['BE','EUR'],['AT','EUR'],['PT','EUR'],['FI','EUR'],['GR','EUR'],['SE','SEK'],['DK','DKK'],['NO','NOK'],['CH','CHF'],
] as const;
export type Country=typeof countries[number][0];
export const defaultCountry:Country='IN';
export function isCountry(value:unknown):value is Country{return typeof value==='string'&&countries.some(c=>c[0]===value);}
export type RegionalRates={booking:{monthly:number;annual:number;setup:number};growth:{monthly:number;annual:number;setup:number};voiceMonthly:number};
/** Add approved local rates HERE. Null markets intentionally show a local quote, never invented rates. */
// Public rates are intentionally unpublished in every market. Request a quote.
export const regionalPrices:Partial<Record<Country,RegionalRates>>={};
export function countryCurrency(country:Country){return countries.find(c=>c[0]===country)![1];}
export function formatRegionalMoney(value:number,country:Country,locale='en',digits=0){return new Intl.NumberFormat(locale,{style:'currency',currency:countryCurrency(country),minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);}
export function planRates(country:Country,id:string){return id==='booking'||id==='growth'?regionalPrices[country]?.[id]:undefined;}
