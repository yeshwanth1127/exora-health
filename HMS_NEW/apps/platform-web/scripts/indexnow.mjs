// Prepare once, deploy, then explicitly submit. IndexNow is for participating engines, not Google.
import {readFile,writeFile,access} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
const configUrl=new URL('../indexnow.json',import.meta.url),publicDir=new URL('../public/',import.meta.url);
const mode=process.argv[2]||'--dry-run';
if(mode==='--prepare'){
 let exists=false;try{await access(configUrl);exists=true;}catch{}
 if(exists)throw Error('indexnow.json already exists; keep the deployed key stable.');
 const key=randomBytes(24).toString('hex');
 await writeFile(configUrl,JSON.stringify({key},null,2)+'\n');await writeFile(new URL(key+'.txt',publicDir),key+'\n');
 console.log('Public verification file prepared. Rebuild and deploy before --submit.');process.exit(0);
}
const {key}=JSON.parse(await readFile(configUrl,'utf8').catch(()=>{throw Error('Run --prepare once, then rebuild and deploy.');}));
if(!/^[a-f0-9]{48}$/.test(key))throw Error('Invalid verification key.');
const sitemap=await readFile(new URL('../out/sitemap.xml',import.meta.url),'utf8');
const urlList=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
if(!urlList.length)throw Error('No search-enabled public URLs in the exported sitemap.');
const origin=new URL(urlList[0]).origin,host=new URL(origin).host;
if(urlList.some(url=>new URL(url).origin!==origin))throw Error('Sitemap spans multiple origins.');
const payload={host,key,keyLocation:origin+'/'+key+'.txt',urlList};
if(mode!=='--submit'){console.log(JSON.stringify({...payload,key:'[public verification key]'},null,2));console.log('Dry run only. No URLs submitted.');process.exit(0);}
const proof=await fetch(payload.keyLocation,{redirect:'error'});
if(!proof.ok||(await proof.text()).trim()!==key)throw Error('Deployed verification file is unavailable or wrong.');
const liveSitemap=await fetch(origin+'/sitemap.xml',{redirect:'error'});
if(!liveSitemap.ok)throw Error('Deployed sitemap is not reachable.');
const text=await liveSitemap.text();if(urlList.some(url=>!text.includes(url)))throw Error('Local and deployed sitemap differ. Deploy before submitting.');
const response=await fetch('https://api.indexnow.org/indexnow',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
if(![200,202].includes(response.status))throw Error('IndexNow response: '+response.status+' '+await response.text());
console.log('URLs notified: '+urlList.length+'. Receipt does not establish crawling, indexing or ranking.');
