import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

const source=await fs.readFile(new URL('../src/lib/brand.ts',import.meta.url),'utf8');
async function withName(name){const text=source.replace(/export const BRAND_NAME = "[^"]*";/,`export const BRAND_NAME = ${JSON.stringify(name)};`);const js=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;return import('data:text/javascript,'+encodeURIComponent(js));}
test('one setting brands nested static content, including HTML and uppercase labels',async()=>{const brand=await withName('ClinicSheet');assert.equal(brand.brandText('Explore Capture · CAPTURE HELP'),'Explore ClinicSheet · CLINICSHEET HELP');assert.deepEqual(brand.brandContent({html:'<h2>Capture workspace</h2>',cards:['Capture updates',4],ready:true}),{html:'<h2>ClinicSheet workspace</h2>',cards:['ClinicSheet updates',4],ready:true});});
test('brand names containing punctuation or the original word are replaced once',async()=>{for(const name of ['Care & Co.',"Dr. O’Neil",'CAPTURE Suite','$Care']){const brand=await withName(name);assert.equal(brand.brandText('Capture'),name);assert.equal(brand.brandText('CAPTURE'),name.toUpperCase());}});
