// Local review fixture. No real NDR details, clinicians or live booking writes are supplied.
import http from 'node:http';import {readFile} from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../dist'),port=Number(process.env.PORT||5242);
const name=process.env.PREVIEW_HOSPITAL_NAME||'NDR Hospital',slug='editorial-review';
const json=(response,value)=>{response.setHeader('content-type','application/json');response.end(JSON.stringify(value));};
http.createServer(async(request,response)=>{
 const url=new URL(request.url,'http://localhost');response.setHeader('cache-control','no-store');
 if(request.method!=='GET'){response.statusCode=405;response.end('Read-only review fixture');return;}
 if(url.pathname==='/website-config.js'){response.setHeader('content-type','application/javascript');response.end(`window.HMS_WEBSITE=${JSON.stringify({bookingSite:slug})};`);return;}
 if(url.pathname==='/public/v1/website'){json(response,{name,organisation:name,slug,city:'',timezone:'Asia/Kolkata',address:'',phone:'',content:{photos:[],packages:[]}});return;}
 if(url.pathname===`/public/v1/booking/${slug}/catalog`){const today=new Date().toISOString().slice(0,10);json(response,{siteSlug:slug,clinicName:name,timezone:'Asia/Kolkata',today,bookingUntil:today,doctors:[]});return;}
 if(url.pathname.startsWith('/public/')){response.statusCode=404;json(response,{error:'Not available in the review fixture'});return;}
 try{let file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)&&file!==root)throw Error();if(!path.extname(file))file=path.join(root,'index.html');const body=await readFile(file);response.setHeader('content-type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.jpg':'image/jpeg'}[path.extname(file)]||'application/octet-stream'));response.end(body);}catch{response.statusCode=404;response.end('Not found');}
}).listen(port,'127.0.0.1',()=>process.stdout.write(`Read-only local template fixture: http://127.0.0.1:${port}\n`));
