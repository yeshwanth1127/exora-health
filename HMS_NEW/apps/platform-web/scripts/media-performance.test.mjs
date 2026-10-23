import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {transpileModule,ModuleKind} from 'typescript';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('src/lib/optimized-images.json',root)));
async function moduleFrom(file,replace=source=>source){let source=replace(readFileSync(new URL(file,root),'utf8'));return import('data:text/javascript,'+encodeURIComponent(transpileModule(source,{compilerOptions:{module:ModuleKind.ESNext}}).outputText));}
test('image output preserves every source and supplies stable WebP sizes without upscaling',()=>{
 const inventory=JSON.parse(readFileSync(new URL('docs/performance/media-inventory.json',root)));
 for(const image of inventory.images){
  const bytes=readFileSync(new URL('public'+image.source,root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sourceSha256,image.source);
  for(const variant of image.variants){assert.ok(variant.width<=image.width);assert.match(variant.src,/\.[a-f0-9]{10}\.\d+\.webp$/);assert.ok(existsSync(new URL('public'+variant.src,root)));}
 }
});
test('responsive bindings keep external images and intentional alternate crops untouched',async()=>{
 const {responsiveImage}=await moduleFrom('src/lib/responsive-image.ts',source=>source.replace("import images from './optimized-images.json';",'const images='+JSON.stringify(manifest)+';'));
 assert.equal(responsiveImage('https://example.com/photo.jpg'),undefined);
 const logo='/assets/capture-brand/reception-bell.png';
 assert.equal(responsiveImage(logo,{srcSet:'/some/other-crop.webp 2x'}),undefined);
 const small=responsiveImage(logo,{width:64});assert.equal(small.sizes,'64px');assert.match(small.src,/\.128\.webp$/);
 assert.match(small.srcSet,/32w/);assert.equal(small.width,1254);assert.equal(small.height,1254);
 assert.equal(responsiveImage(logo,{sizes:'80px'}).sizes,'80px');
});
test('font compression retains the original glyph map and source bytes',()=>{
 const fonts=JSON.parse(readFileSync(new URL('docs/performance/font-inventory.json',root)));
 for(const font of fonts){assert.equal(createHash('sha256').update(readFileSync(new URL('public/'+font.source,root))).digest('hex'),font.sourceSha256);assert.equal(font.glyphMapPreserved,true);assert.ok(font.optimizedBytes<font.originalBytes);assert.ok(existsSync(new URL('public/'+font.optimized,root)));}
});
