import { BrandSymbol } from "../components/brand-logo";
/** Shared product mark for legacy icon slots. */
export default function Icon({dittoId}:{dittoId?:string}){return <span data-ditto-id={dittoId}><BrandSymbol /></span>;}
