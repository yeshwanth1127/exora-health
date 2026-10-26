import {createContext} from 'react';
export const Nav=createContext<(to:string)=>void>(()=>{});
