import { describe, expect, it } from 'vitest';
import {
  parseWhatsAppProviderConfig, resolveWhatsAppBinding, resolveWhatsAppAccessToken,
  WhatsAppProviderConfigError, type ProviderEnvironment,
} from './whatsapp-provider-config.ts';
const a = {tenantId:'11111111-1111-4111-8111-111111111111',facilityId:'22222222-2222-4222-8222-222222222222',phoneNumberId:'123456789',businessAccountId:'987654321',accessTokenEnv:'HMS_WA_TOKEN_CLINIC_A'};
const b = {...a,facilityId:'33333333-3333-4333-8333-333333333333',phoneNumberId:'444444444',businessAccountId:'555555555',accessTokenEnv:'HMS_WA_TOKEN_CLINIC_B'};
const environment = (rows:unknown[]=[a,b], extra:ProviderEnvironment={}):ProviderEnvironment => ({WA_CLINIC_BINDINGS_JSON:JSON.stringify(rows),WA_APP_SECRET:'test-app-secret'.padEnd(32,'x'),WA_VERIFY_TOKEN:'test-verification',WA_GRAPH_VERSION:'v24.0',...extra});
describe('server-only WhatsApp clinic credential bindings',()=>{
  it('resolves exact clinic metadata without exposing credential values',()=>{
    const env=environment([a,b],{HMS_WA_TOKEN_CLINIC_A:'sensitive-token-a',HMS_WA_TOKEN_CLINIC_B:'sensitive-token-b'});
    const resolved=resolveWhatsAppBinding(a.phoneNumberId,env)!;
    expect(resolved).toMatchObject({...a,mode:'multi_clinic',accessTokenPresent:true,inboundConfigured:true,outboundCredentialsReady:true});
    const serialized=JSON.stringify(parseWhatsAppProviderConfig(env));
    expect(serialized).not.toContain('sensitive-token');expect(serialized).not.toContain('test-app-secret');expect(serialized).not.toContain('test-verification');
    expect(resolveWhatsAppBinding('777777777',env)).toBeNull();
  });
  it('keeps inbound configuration independent of outbound token readiness and never falls back to another token',()=>{
    const env=environment([a,b],{HMS_WA_TOKEN_CLINIC_A:'a-only',WA_ACCESS_TOKEN:'global-legacy-token'});
    const resolvedA=resolveWhatsAppBinding(a.phoneNumberId,env)!,resolvedB=resolveWhatsAppBinding(b.phoneNumberId,env)!;
    expect(resolvedA.accessTokenPresent).toBe(true);expect(resolvedB).toMatchObject({inboundConfigured:true,accessTokenPresent:false,outboundCredentialsReady:false});
    expect(resolveWhatsAppAccessToken(resolvedA,env)).toBe('a-only');expect(resolveWhatsAppAccessToken(resolvedB,env)).toBeNull();
    expect(resolveWhatsAppAccessToken({...resolvedB,accessTokenEnv:a.accessTokenEnv},env)).toBeNull();
    expect(resolveWhatsAppAccessToken({...resolvedA,tenantId:b.facilityId},env)).toBeNull();
  });
  it('requires both shared inbound secrets and rejects whitespace credentials as absent',()=>{
    for(const extra of [{WA_APP_SECRET:undefined},{WA_VERIFY_TOKEN:undefined},{WA_APP_SECRET:'   '}]){
      expect(resolveWhatsAppBinding(a.phoneNumberId,environment([a],{HMS_WA_TOKEN_CLINIC_A:'test-token',...extra}))).toMatchObject({inboundConfigured:false,outboundCredentialsReady:false});
    }
    expect(resolveWhatsAppBinding(a.phoneNumberId,environment([a],{HMS_WA_TOKEN_CLINIC_A:'  '}))).toMatchObject({accessTokenPresent:false});
  });
  it('keeps signed callback authentication available without the GET handshake token while refusing outbound credentials',()=>{
    for(const verifyToken of [undefined,'','   ']){
      const env=environment([a],{WA_VERIFY_TOKEN:verifyToken,HMS_WA_TOKEN_CLINIC_A:'internal-token'});
      const resolved=resolveWhatsAppBinding(a.phoneNumberId,env)!;
      expect(resolved).toMatchObject({signatureConfigured:true,inboundConfigured:false,accessTokenPresent:true,outboundCredentialsReady:false});
      expect(resolveWhatsAppAccessToken(resolved,env)).toBeNull();
      expect(resolveWhatsAppAccessToken({...resolved,outboundCredentialsReady:true,inboundConfigured:true},env)).toBeNull();
    }
    expect(resolveWhatsAppBinding(a.phoneNumberId,environment([a],{WA_APP_SECRET:'short'}))).toMatchObject({signatureConfigured:false});
    expect(resolveWhatsAppBinding(a.phoneNumberId,{WA_PHONE_NUMBER_ID:a.phoneNumberId,WA_APP_SECRET:'legacy-secret'})).toMatchObject({signatureConfigured:true,inboundConfigured:false,outboundCredentialsReady:false});
  });
  it('requires a sufficiently long managed app secret and a pinned graph version for outbound readiness only',()=>{
    const short=resolveWhatsAppBinding(a.phoneNumberId,environment([a],{WA_APP_SECRET:'short',HMS_WA_TOKEN_CLINIC_A:'token'}))!;
    expect(short).toMatchObject({inboundConfigured:false,outboundCredentialsReady:false});
    expect(resolveWhatsAppAccessToken(short,environment([a],{WA_APP_SECRET:'short',HMS_WA_TOKEN_CLINIC_A:'token'}))).toBeNull();
    for(const version of [undefined,'','latest','v24','v24.0/anything',' v24.0','v1234.0']){
      expect(resolveWhatsAppBinding(a.phoneNumberId,environment([a],{WA_GRAPH_VERSION:version,HMS_WA_TOKEN_CLINIC_A:'token'}))).toMatchObject({inboundConfigured:true,outboundCredentialsReady:false});
    }
    expect(resolveWhatsAppBinding(a.phoneNumberId,environment([a],{WA_GRAPH_VERSION:'v999.99',HMS_WA_TOKEN_CLINIC_A:'token'}))).toMatchObject({outboundCredentialsReady:true}); // format readiness, not provider support
  });
  it('rejects duplicate phones and duplicate clinics including case variants',()=>{
    for(const rows of [[a,{...b,phoneNumberId:a.phoneNumberId}],[a,{...b,facilityId:a.facilityId}],[{...a,tenantId:'abcdefab-abcd-4abc-8abc-abcdefabcdef'},{...b,tenantId:'ABCDEFAB-ABCD-4ABC-8ABC-ABCDEFABCDEF',facilityId:a.facilityId}]]){
      expect(()=>parseWhatsAppProviderConfig(environment(rows))).toThrow(WhatsAppProviderConfigError);
    }
  });
  it('rejects malformed/unknown descriptor fields and unsafe environment names without echoing config values',()=>{
    for(const row of [null,[],{...a,secret:'never-print-this'},{...a,tenantId:'invalid-id'},{...a,phoneNumberId:123456},{...a,phoneNumberId:'1234'},{...a,businessAccountId:'../bad'},{...a,accessTokenEnv:'WA_ACCESS_TOKEN'},{...a,accessTokenEnv:'HMS_WA_TOKEN_../../secret'},{...a,accessTokenEnv:'HMS_WA_TOKEN_'+ 'A'.repeat(81)},{...a,accessTokenEnv:'HMS_WA_TOKEN_lowercase'}]){
      try{parseWhatsAppProviderConfig(environment([row]));throw new Error('accepted invalid config');}catch(error){expect(error).toBeInstanceOf(WhatsAppProviderConfigError);expect((error as Error).message).not.toContain('never-print-this');expect((error as Error).message).not.toContain('../');}
    }
  });
  it('does not fall back when explicit configuration is malformed or explicitly empty',()=>{
    const legacy={WA_PHONE_NUMBER_ID:a.phoneNumberId,WA_BUSINESS_ACCOUNT_ID:a.businessAccountId,WA_ACCESS_TOKEN:'legacy-token'};
    for(const raw of ['', 'not-json-with-sensitive-secret','{}','null','true'])expect(()=>parseWhatsAppProviderConfig({...legacy,WA_CLINIC_BINDINGS_JSON:raw})).toThrow(WhatsAppProviderConfigError);
    const config=parseWhatsAppProviderConfig({...legacy,WA_CLINIC_BINDINGS_JSON:'[]'});expect(config).toEqual({mode:'multi_clinic',bindings:[]});
    expect(resolveWhatsAppBinding(a.phoneNumberId,{...legacy,WA_CLINIC_BINDINGS_JSON:'[]'})).toBeNull();
  });
  it('bounds the number of bindings and validates every row before resolving a phone',()=>{
    expect(()=>parseWhatsAppProviderConfig(environment(Array(1001).fill(a)))).toThrow(WhatsAppProviderConfigError);
    expect(()=>resolveWhatsAppBinding('000000000',environment([a,{...b,businessAccountId:'invalid'}]))).toThrow(WhatsAppProviderConfigError);
  });
  it('refuses unpinned production legacy phones but permits explicitly pinned or absent configurations',()=>{
    expect(()=>parseWhatsAppProviderConfig({NODE_ENV:'production',WA_PHONE_NUMBER_ID:a.phoneNumberId})).toThrow(WhatsAppProviderConfigError);
    expect(parseWhatsAppProviderConfig({NODE_ENV:'production'})).toEqual({mode:'legacy',bindings:[]});
    expect(parseWhatsAppProviderConfig({NODE_ENV:'production',WA_PHONE_NUMBER_ID:''})).toEqual({mode:'legacy',bindings:[]});
    const explicit=environment([a],{NODE_ENV:'production',WA_PHONE_NUMBER_ID:b.phoneNumberId});
    expect(resolveWhatsAppBinding(a.phoneNumberId,explicit)).toMatchObject({tenantId:a.tenantId,facilityId:a.facilityId,mode:'multi_clinic'});
    expect(resolveWhatsAppBinding(b.phoneNumberId,explicit)).toBeNull();
  });
  it('uses the isolated legacy fallback only when explicit bindings are absent',()=>{
    expect(parseWhatsAppProviderConfig({})).toEqual({mode:'legacy',bindings:[]});
    const env={WA_PHONE_NUMBER_ID:a.phoneNumberId,WA_BUSINESS_ACCOUNT_ID:a.businessAccountId,WA_ACCESS_TOKEN:' legacy-token ',WA_APP_SECRET:'app-secret',WA_VERIFY_TOKEN:'verify-token',WA_GRAPH_VERSION:'v24.0'};
    const legacy=resolveWhatsAppBinding(a.phoneNumberId,env)!;
    expect(legacy).toMatchObject({mode:'legacy',tenantId:null,facilityId:null,businessAccountId:a.businessAccountId,accessTokenEnv:'WA_ACCESS_TOKEN',inboundConfigured:true,outboundCredentialsReady:true});
    expect(resolveWhatsAppAccessToken(legacy,env)).toBe('legacy-token');
    const inboundOnly=resolveWhatsAppBinding(a.phoneNumberId,{WA_PHONE_NUMBER_ID:a.phoneNumberId,WA_APP_SECRET:'secret',WA_VERIFY_TOKEN:'verify'})!;
    expect(inboundOnly).toMatchObject({businessAccountId:null,inboundConfigured:true,outboundCredentialsReady:false});
    expect(()=>parseWhatsAppProviderConfig({WA_PHONE_NUMBER_ID:'invalid'})).toThrow(WhatsAppProviderConfigError);
  });
});
