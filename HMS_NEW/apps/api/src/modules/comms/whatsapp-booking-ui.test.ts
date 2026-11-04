import {describe,it,expect} from 'vitest';
import {bookingReply,bookingUi,resolveBookingReply} from './whatsapp-booking-ui.ts';
describe('native booking controls',()=>{
 it('keeps choice IDs authoritative and honors stop/human controls independently of their label',()=>{
   const reply=bookingReply({type:'interactive',interactive:{list_reply:{id:'pw.current.1',title:'CONFIRM'}}});
   expect(reply.body).toBe('CONFIRM');expect(resolveBookingReply(reply.interaction,{menuToken:'current',menuCommands:['1']})).toBe('1');
   expect(resolveBookingReply(reply.interaction,{menuToken:'other',menuCommands:['1']})).toBeUndefined();
   expect(bookingReply({type:'interactive',interactive:{button_reply:{id:'pw.old.STOP',title:'No thanks'}}}).body).toBe('STOP');
   expect(bookingReply({type:'interactive',interactive:{button_reply:{id:'pw.old.HUMAN',title:'Reception'}}}).body).toBe('HUMAN');
 });
 it('rejects malformed form data and does not accept a token for another step',()=>{
   for(const raw of ['{',JSON.stringify({flow_token:'token',patient_name:42}),'x'.repeat(4097)])expect(bookingReply({type:'interactive',interactive:{type:'nfm_reply',nfm_reply:{response_json:raw}}}).interaction).toBeNull();
   const reply=bookingReply({type:'interactive',interactive:{type:'nfm_reply',nfm_reply:{response_json:JSON.stringify({flow_token:'token',patient_name:'Test Visitor'})}}});
   expect(resolveBookingReply(reply.interaction,{step:'name',formToken:'token'})).toBe('Test Visitor');
   expect(resolveBookingReply(reply.interaction,{step:'confirm',formToken:'token'})).toBeUndefined();
 });
 it('leaves room for date navigation and scopes the name form without an empty dynamic payload',()=>{
   const state:any={step:'slot',timezone:'Asia/Kolkata',hasMore:true,choices:Array.from({length:7},(_,i)=>({startsAt:new Date(Date.now()+86400000+i*900000).toISOString(),feeMinor:50000}))};
   const menu:any=bookingUi(state,'unused',{testMode:true});expect(menu.action.sections[0].rows).toHaveLength(10);
   expect(new Set(menu.action.sections[0].rows.map((r:any)=>r.id)).size).toBe(10);
   const formState:any={step:'name'};
   const form:any=bookingUi(formState,'unused',{detailsFlowId:'999999999999999',detailsFlowMode:'draft'});
   expect(form.action.parameters.flow_token).toBe(formState.formToken);
   expect(form.action.parameters.flow_action_payload).toEqual({screen:'DETAILS'});
 });
});
