import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicOrigin} from '../src/lib/site.ts';
import {publicPages,jsonLd,pageMetadata} from '../src/lib/seo.ts';
test('only valid public HTTPS origins can enable canonical URLs',()=>{
 assert.equal(publicOrigin('https://health.exora.solutions/'),'https://health.exora.solutions');
 for(const value of ['', 'http://health.exora.solutions','https://localhost','https://127.0.0.1','https://clinic.test','https://clinic.local','https://clinic.invalid','https://host.example','https://user:password@host.com','https://host.com/path','https://host.com?key=private'])assert.equal(publicOrigin(value),'');
});
test('public search inventory excludes private and fictional dashboard routes',()=>{
 assert.equal(new Set(publicPages.map(p=>p.path)).size,publicPages.length);
 assert.ok(!publicPages.some(p=>/^\/(onboarding|quote|demo|admin|control)/.test(p.path)));
 assert.equal(new Set(publicPages.map(p=>p.title)).size,publicPages.length);
 assert.equal(pageMetadata('/pricing').robots.follow,true);
});
test('JSON-LD escapes script terminators without inventing trust signals',()=>{
 const value=jsonLd({name:'</script><script>alert(1)</script>'});assert.ok(!value.includes('</script>'));assert.equal(JSON.parse(value).name,'</script><script>alert(1)</script>');
});
