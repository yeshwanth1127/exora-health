import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../out/',import.meta.url));
const sitemap=await readFile(path.join(root,'sitemap.xml'),'utf8');
const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]));
if(!urls.length)throw Error('No public sitemap URLs. Build with NEXT_PUBLIC_SITE_ORIGIN and NEXT_PUBLIC_SEARCH_INDEXING=true.');
const origin=urls[0].origin,issues=[],titles=new Set();
for(const url of urls){
 const file=path.join(root,url.pathname==='/'?'index.html':url.pathname.slice(1)+'.html');
 const html=await readFile(file,'utf8');
 const canonical=[...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*>/g)].map(m=>m[0].match(/href="([^"]+)"/)?.[1]);
 if(canonical.length!==1||new URL(canonical[0]).href!==url.href)issues.push(url.pathname+': invalid canonical');
 if(/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/.test(html))issues.push(url.pathname+': noindex');
 const title=html.match(/<title>(.*?)<\/title>/s)?.[1];if(!title||titles.has(title))issues.push(url.pathname+': missing/duplicate title');titles.add(title);
 if(!/<meta[^>]*name="description"/.test(html))issues.push(url.pathname+': missing description');
 if((html.match(/<h1\b/g)||[]).length!==1)issues.push(url.pathname+': expected one H1');
 for(const script of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)){try{JSON.parse(script[1]);}catch{issues.push(url.pathname+': invalid structured data');}}
 for(const match of html.matchAll(/<(?:a|img)\b[^>]*(?:href|src)="(\/[^"#?]*)/g)){
  const target=decodeURIComponent(match[1]);
  const candidates=[path.join(root,target),path.join(root,target+'.html'),path.join(root,target,'index.html')];
  if(!(await Promise.all(candidates.map(p=>stat(p).then(s=>s.isFile()).catch(()=>false)))).some(Boolean))issues.push(url.pathname+': missing local URL '+target);
 }
}
for(const route of ['/quote','/onboarding','/onboarding/welcome','/onboarding/workspace','/demo/overview']){
 const html=await readFile(path.join(root,route+'.html'),'utf8');if(!/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/.test(html))issues.push(route+': missing noindex');
}
const robots=await readFile(path.join(root,'robots.txt'),'utf8');if(!robots.includes('Allow: /')||!robots.includes(origin+'/sitemap.xml'))issues.push('robots missing allow/sitemap');
if(issues.length){console.error(issues.join('\n'));process.exit(1);}
console.log(JSON.stringify({publicPages:urls.length,privatePages:5,canonicalOrigin:origin,issues:[]},null,2));
