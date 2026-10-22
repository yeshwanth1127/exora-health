import { test, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { exportedPlatformPage } from './platform-pages.ts';
test('exported marketing routes, deep links and missing assets resolve correctly',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'platform-pages-'));
 try{
  await mkdir(path.join(root,'product'));await writeFile(path.join(root,'index.html'),'home');await writeFile(path.join(root,'product/features.html'),'features');await writeFile(path.join(root,'onboarding.html'),'setup');
  expect(await exportedPlatformPage(root,'/')).toBe('index.html');expect(await exportedPlatformPage(root,'/product/features?from=nav')).toBe('product/features.html');expect(await exportedPlatformPage(root,'/onboarding/')).toBe('onboarding.html');
  for(const url of ['/missing','/_next/missing.js','/control/v1/missing','/admin/private','/../index','/%2e%2e/index','/.env','/%ZZ'])expect(await exportedPlatformPage(root,url)).toBeNull();
 }finally{await rm(root,{recursive:true,force:true});}
});
