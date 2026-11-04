'use client';
import {createContext,useContext,useState,useEffect,type ReactNode} from 'react';
import {type Country,defaultCountry,isCountry} from '../../../lib/regional-pricing';
const RegionContext=createContext<{country:Country;setCountry:(country:Country)=>void}>({country:defaultCountry,setCountry:()=>{}});
export function RegionProvider({initialCountry,children}:{initialCountry:Country;children:ReactNode}){
 const [country,update]=useState(initialCountry);
 // Also restore the preference when this app is deliberately exported to static hosting.
 useEffect(()=>{const saved=document.cookie.split('; ').find(item=>item.startsWith('capture-country='))?.split('=')[1];if(isCountry(saved))update(saved);},[]);
 return <RegionContext.Provider value={{country,setCountry:value=>{update(value);document.cookie=`capture-country=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;}}}>{children}</RegionContext.Provider>;
}
export const useRegion=()=>useContext(RegionContext);
