// Local synthetic acceptance harness. Uses hms_test; never run against a customer database.
import { config } from '../../../../db/scripts/config.mjs';
import { startKit } from '../../../api/src/http/test-kit.ts';
import { buildServer } from '../../../api/src/server.ts';
import { createVerifier } from '../../../api/src/auth/verify.ts';
import { signDevToken } from '../../../api/src/auth/dev-token.ts';
import { DEV_ISSUER,DEV_SECRET_DEFAULT } from '../../../api/src/config.ts';
if (!['127.0.0.1','localhost'].includes(new URL(config.testDatabaseUrl).hostname) || !['127.0.0.1','localhost'].includes(new URL(config.testAppDatabaseUrl).hostname)) throw Error('Use a disposable loopback database');
if (process.env.NODE_ENV === 'production') throw Error('Local acceptance harness only');
const run = Date.now().toString(), phoneId = run;
const sites = new Map();
const managed = {fetcher:async (url:any,init:any={})=>{
 const u=new URL(String(url)),json=(v:any)=>new Response(JSON.stringify(v));
 if(u.host==='analytics.example.test'){
  if(u.pathname==='/api/websites'&&init.method==='POST'){const b=JSON.parse(init.body);sites.set(b.id,b);return json(b);}
  if(u.pathname.endsWith('/stats'))return json({visitors:0,pageviews:0,comparison:{visitors:0,pageviews:0}});
  if(u.pathname.endsWith('/pageviews'))return json({pageviews:[],sessions:[]});
  return json([]);
 }
 if(u.pathname.endsWith('/oauth/access_token'))return json({access_token:'synthetic-provider-token'});
 if(u.pathname.endsWith('/phone_numbers'))return json({data:[{id:phoneId,display_phone_number:'+919876543210',verified_name:'Permission Test Clinic',code_verification_status:'VERIFIED',is_on_biz_app:true}]});
 if(u.pathname.endsWith('/smb_app_data'))return json({request_id:'synthetic-sync'});
 return json({success:true});
},encryptionKey:Buffer.alloc(32,6),publicOrigin:'http://127.0.0.1:5197',whatsappSending:false,
meta:{appId:'111111',appSecret:'synthetic-secret',configId:'222222',graphVersion:'v23.0'},google:{clientId:'synthetic-client',clientSecret:'synthetic-secret'},umami:{origin:'https://analytics.example.test',key:'synthetic-key'}};
const k=await startKit('browser-permissions',undefined,undefined,managed);
const owner=await k.person('Browser Owner','tenant_admin',null),desk=await k.person('Browser Reception','front_desk',k.tenant.facilityId);
for(const [who,p] of [['owner',owner],['reception',desk]] as const){await k.admin.query('UPDATE platform.user_account SET identity_subject=$1 WHERE staff_id=$2',[run + ':' + who,p.staffId]);}
await k.app.close();
const app=buildServer({db:k.db,managed,publicTenantId:k.tenant.tenantId,verifier:createVerifier({mode:'dev',issuer:DEV_ISSUER,secret:DEV_SECRET_DEFAULT}),devLogin:async(subject)=>{if(!['owner','reception'].includes(subject))throw Error('Synthetic identities only');return signDevToken(run + ':' + subject);}});
await app.listen({port:3067,host:'127.0.0.1'});console.log('Synthetic API ready on 3067; subjects owner and reception');
process.on('SIGTERM',()=>void app.close().then(()=>k.close()).then(()=>process.exit(0)));
