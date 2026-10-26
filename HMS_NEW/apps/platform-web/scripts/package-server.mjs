/** Package the SSR runtime without publishing source files from public/. */
import {readdir,cp,mkdir,copyFile,rm,access,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {publishable} from './package-public.mjs';
const root=process.cwd(), standalone=path.join(root,'.next/standalone');
const runtime=JSON.parse(await readFile(path.join(root,'.next/required-server-files.json'),'utf8'));
const relativeApp=path.relative(runtime.config.outputFileTracingRoot || root,root);
if(relativeApp.startsWith('..') || path.isAbsolute(relativeApp)) throw new Error('App is outside the tracing root');
const server=path.join(standalone,relativeApp);
await access(path.join(server,'server.js'));
async function walk(dir,prefix='') {let files=[];for(const entry of await readdir(dir,{withFileTypes:true})){const name=path.posix.join(prefix,entry.name);if(entry.isDirectory())files.push(...await walk(path.join(dir,entry.name),name));else if(entry.isFile())files.push(name);}return files;}
await rm(path.join(server,'public'),{recursive:true,force:true});
let count=0;
for(const file of await walk(path.join(root,'public'))) {
 if(!publishable(file))continue;
 const target=path.join(server,'public',file);await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(root,'public',file),target);count++;
}
await cp(path.join(root,'.next/static'),path.join(server,'.next/static'),{recursive:true});
const manifest=JSON.parse(await readFile(path.join(server,'package.json'),'utf8'));
manifest.scripts={start:'node server.js'};
await writeFile(path.join(server,'package.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`SSR runtime ready: ${path.relative(root,path.join(server,'server.js'))}; ${count} sanitized public files.`);
