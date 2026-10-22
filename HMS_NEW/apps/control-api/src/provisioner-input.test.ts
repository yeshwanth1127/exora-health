import { test, expect } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
test('production input accepts Launch voice=false and rejects unknown website templates before infrastructure work',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'provision-input-'));
 try{
  const config=path.join(dir,'config'),request=path.join(dir,'request.json');
  await writeFile(config,`OIDC_PROVISIONER=/usr/bin/true\nTENANT_ROOT=${dir}\nWILDCARD_CERT_NAME=missing-local-verification-${randomUUID()}\n`);
  const claim={allocated_port:8200,payload:{slug:'test-clinic',organisation:'Local Test',ownerName:'Owner',email:'owner@example.test',facilityName:'Test Clinic',city:'Bengaluru',plan:'launch',voice:false,websiteTemplate:'sri-lakshmi',facilityType:'hospital',timezone:'Asia/Dubai'}};
  await writeFile(request,JSON.stringify(claim));
  const run=()=>spawnSync('bash',['deploy/production/provision-tenant-production',request],{encoding:'utf8',env:{...process.env,EXORA_PROVISIONER_CONFIG:config}});
  const valid=run();expect(valid.status).toBe(2);expect(valid.stderr).toContain('wildcard certificate');
  await writeFile(request,JSON.stringify({...claim,payload:{...claim.payload,websiteTemplate:'unknown'}}));
  const invalid=run();expect(invalid.status).not.toBe(0);expect(invalid.stderr).not.toContain('wildcard certificate');
 }finally{await rm(dir,{recursive:true,force:true});}
});
