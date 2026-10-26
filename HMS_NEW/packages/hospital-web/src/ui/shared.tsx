import {createContext} from 'react';
export const Router=createContext<(path:string)=>void>(()=>{});
export const photos=[{src:'/images/cardiology-consultation.jpg',width:1200,height:800,alt:'Illustrative consultation photograph',title:'A conversation about your care',caption:'Existing illustrative photograph, not Swastikaa Hospital.'},{src:'/images/pediatrics-specialty.jpg',width:1200,height:800,alt:'Illustrative paediatric consultation',title:'Care at every stage',caption:'Existing illustrative photograph, not Swastikaa Hospital.'}];
