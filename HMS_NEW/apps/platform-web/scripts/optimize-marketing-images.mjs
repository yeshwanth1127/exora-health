import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const roots=['capture-illustrations','capture-home-product','capture-home-enquiries','capture-product-art','capture-navigation','capture-onboarding','capture-footer'];
const manifest=[];
for(const root of roots){
 const dir=path.join('public/assets',root);
 for(const item of await fs.readdir(dir,{withFileTypes:true})){
  if(!item.isFile()||!item.name.endsWith('.png'))continue;
  const input=path.join(dir,item.name),output=input.replace(/\.png$/,'.webp');
  const limit=['capture-onboarding','capture-footer','capture-navigation'].includes(root)?640:1000;
  await sharp(input).resize({width:limit,height:limit,fit:'inside',withoutEnlargement:true}).webp({quality:86,alphaQuality:95,effort:5}).toFile(output);
  manifest.push({from:'/'+input.slice(7),to:'/'+output.slice(7),before:(await fs.stat(input)).size,after:(await fs.stat(output)).size});
 }
}
async function rewrite(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())await rewrite(file);else if(/\.(tsx?|css|json)$/.test(file)){const old=await fs.readFile(file,'utf8');let next=old;for(const m of manifest)next=next.split(m.from).join(m.to);if(file.endsWith('onboarding-mascot.tsx'))next=next.replace('${asset}.png','${asset}.webp');if(next!==old)await fs.writeFile(file,next);}}}
await rewrite('src');
await fs.writeFile('../rebrand/launch-polish/image-optimization.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify({images:manifest.length,before:manifest.reduce((s,m)=>s+m.before,0),after:manifest.reduce((s,m)=>s+m.after,0)}));
