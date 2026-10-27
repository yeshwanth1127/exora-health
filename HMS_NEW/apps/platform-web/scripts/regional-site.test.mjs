import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
async function moduleAt(file){const source=await readFile(new URL(file,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;return import('data:text/javascript,'+encodeURIComponent(js));}
const region=await moduleAt('../src/lib/regional-pricing.ts');const i18n=await moduleAt('../src/lib/i18n/config.ts');const {english}=await moduleAt('../src/lib/i18n/en.ts');
test('public prices remain unpublished in every country, including the US',()=>{
 for(const [country] of region.countries){assert.equal(region.planRates(country,'booking'),undefined);assert.equal(region.planRates(country,'growth'),undefined);}
 assert.equal(region.countryCurrency('IN'),'INR');assert.equal(region.countryCurrency('AU'),'AUD');assert.equal(region.countryCurrency('DE'),'EUR');assert.ok(region.formatRegionalMoney(149,'US','hi').includes('149'));
 assert.equal(region.isCountry('US'),true);assert.equal(region.isCountry('us'),false);assert.equal(region.isCountry('XX'),false);assert.equal(region.isCountry('<script>'),false);
});
test('language destinations preserve public routes and never prefix personal or backend routes',()=>{
 assert.equal(i18n.languageDestination('hi','/pricing'),'/hi/pricing');assert.equal(i18n.languageDestination('fr','/hi/enterprise'),'/fr/enterprise');assert.equal(i18n.languageDestination('en','/fr/pricing'),'/pricing');
 assert.equal(i18n.languageDestination('de','/blog/a-clearer-front-desk'),'/de/blog');assert.equal(i18n.languageDestination('ta','/business-report/private'),'/ta');assert.equal(i18n.languageDestination('es','/control/v1'),'/es');
 assert.equal(i18n.isLocale('en-US'),false);assert.equal(i18n.supportsTranslation('/onboarding'),false);assert.deepEqual(i18n.splitLocale('/ms/pricing'),{locale:'ms',path:'/pricing'});
});
test('every offered translation has all 98 copy keys, no empty values and no brand substitution',async()=>{
 assert.equal(i18n.locales.length,12);assert.equal(Object.keys(english).length,98);
 for(const {code} of i18n.locales){if(code==='en')continue;const copy=JSON.parse(await readFile(new URL(`../src/lib/i18n/${code}.json`,import.meta.url),'utf8'));assert.deepEqual(Object.keys(copy).sort(),Object.keys(english).sort(),code);assert.ok(Object.values(copy).every(v=>typeof v==='string'&&v.trim()),code);assert.notEqual(copy.hero,english.hero,code);assert.ok(!JSON.stringify(copy).includes('Capture'),code);}
});
