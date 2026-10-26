/** Build WebP display variants without changing original artwork or its aspect ratio. */
import {readdir,readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
const root=process.cwd(),publicDir=path.join(root,'public');
const widths=[32,64,128,256,480,768,1280];
async function walk(dir){let found=[];for(const entry of await readdir(dir,{withFileTypes:true})){const name=path.join(dir,entry.name);if(entry.isDirectory())found.push(...await walk(name));else if(entry.isFile())found.push(name);}return found;}
const references=new Set();
for(const file of await walk(path.join(root,'src'))){
 if(!/\.(tsx?|css|js|json)$/.test(file)||file.endsWith('optimized-images.json'))continue;
 const text=await readFile(file,'utf8');
 for(const match of text.matchAll(/\/assets\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp|gif)/g))references.add(match[0]);
}
// Doctor photos are selected through data/template strings rather than literal URLs.
for(const folder of ['assets/dashboard-people','assets/capture-onboarding'])for(const file of await walk(path.join(publicDir,folder)))if(/\.(png|jpe?g|webp)$/.test(file))references.add('/'+path.relative(publicDir,file).split(path.sep).join('/'));
const manifest={},report=[];
await mkdir(path.join(publicDir,'assets/optimized'),{recursive:true});
for(const src of [...references].sort()){
 const file=path.join(publicDir,src.slice(1));let bytes;
 try{bytes=await readFile(file);}catch{continue;}
 const metadata=await sharp(bytes,{animated:true}).metadata();
 // Animated GIFs stay animated. SVGs remain vector and are not part of this pipeline.
 if((metadata.pages||1)>1||!metadata.width||!metadata.height)continue;
 const hash=createHash('sha256').update(bytes).update('capture-webp-v2-q82-e4').digest('hex').slice(0,10);
 const slug=src.slice(8).replace(/\.[^.]+$/,'').replaceAll('/','-');
 const sizes=[...widths.filter(width=>width<metadata.width),Math.min(metadata.width,1280)];
 const variants=[];
 for(const width of [...new Set(sizes)].sort((a,b)=>a-b)){
  const url=`/assets/optimized/${slug}.${hash}.${width}.webp`;
  const target=path.join(publicDir,url.slice(1));
  const data=await sharp(bytes).rotate().resize({width,withoutEnlargement:true}).webp({quality:82,alphaQuality:100,effort:4,smartSubsample:false}).toBuffer();
  await writeFile(target,data);
  variants.push({src:url,width,bytes:data.length});
 }
 const fallback=variants.find(item=>item.width>=768)||variants.at(-1);
 manifest[src]={width:metadata.width,height:metadata.height,src:fallback.src,srcSet:variants.map(item=>`${item.src} ${item.width}w`).join(', ')};
 report.push({source:src,sourceSha256:createHash('sha256').update(bytes).digest('hex'),originalBytes:bytes.length,width:metadata.width,height:metadata.height,hasAlpha:Boolean(metadata.hasAlpha),variants});
}
await writeFile(path.join(root,'src/lib/optimized-images.json'),JSON.stringify(manifest)+'\n');
await writeFile(path.join(root,'docs/performance/media-inventory.json'),JSON.stringify({encoder:sharp.versions.sharp,quality:82,originalsPreserved:true,images:report},null,2)+'\n');
console.log(JSON.stringify({images:report.length,originalReferencedBytes:report.reduce((sum,item)=>sum+item.originalBytes,0),display768Bytes:report.reduce((sum,item)=>sum+(item.variants.find(v=>v.width>=768)||item.variants.at(-1)).bytes,0)}));
