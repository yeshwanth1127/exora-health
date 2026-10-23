import { readdir, readFile, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const blockedRoute = /^\/(?:quote|onboarding|api|admin|staff|control)(?:[/.]|$)/i;
const media = new Set(['.png','.jpg','.jpeg','.webp','.avif','.gif','.svg','.ico','.woff','.woff2','.ttf','.mp4','.webm']);
export function publishable(file) {
  const parts=file.split('/');
  if(parts.some(p=>p.startsWith('.') || p==='references') || blockedRoute.test('/'+file)) return false;
  if(file.startsWith('assets/')) return media.has(path.extname(file)) || file.endsWith('/OFL.txt');
  return /\.(?:html|js|css|txt|xml|md|png|ico|svg|woff2?)$/.test(file) && !file.endsWith('.map');
}
export function contentPolicy(html) {
  const hashes=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(m=>! /\bsrc\s*=/.test(m[1]) && m[2])
    .map(m=>"'sha256-"+createHash('sha256').update(m[2]).digest('base64')+"'");
  return ["default-src 'self'", "script-src 'self' "+[...new Set(hashes)].join(' '), "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https:", "font-src 'self' data:", "worker-src 'self' blob:", "connect-src 'self' https://tiles.openfreemap.org https://us.i.posthog.com https://eu.i.posthog.com", "frame-src 'self'", "media-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'none'"].join('; ');
}
export const hostingRules=`# Static public website only; Apache 2.4 / LiteSpeed shared hosting.
Options -Indexes -MultiViews
DirectoryIndex index.html
ErrorDocument 404 /404.html
RewriteEngine On
# Do not expose application or provisioning routes, even if a future upload includes them.
RewriteRule ^(?:quote|onboarding|api|admin|staff|control)(?:[/.]|$) - [R=404,L,NC]
RewriteRule (^|/)\\.(?!well-known/) - [R=404,L]
RewriteCond %{REQUEST_METHOD} !^(GET|HEAD)$
RewriteRule ^ - [R=405,L]
# Preserve extensionless Next static-export routes.
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_FILENAME}.html -f
RewriteRule ^(.+?)/?$ $1.html [L]
<IfModule mod_headers.c>
Header always set X-Content-Type-Options "nosniff"
Header always set X-Frame-Options "SAMEORIGIN"
Header always set Content-Security-Policy "frame-ancestors 'self'"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"
Header always set X-Robots-Tag "noindex, nofollow"
<FilesMatch "\\.(html|txt|xml)$">
Header set Cache-Control "no-cache"
</FilesMatch>
<FilesMatch "\\.(js|css|woff2?)$">
Header set Cache-Control "public, max-age=31536000, immutable"
</FilesMatch>
</IfModule>
`;
async function walk(dir, prefix='') {let files=[]; for(const entry of await readdir(dir,{withFileTypes:true})) {const name=path.posix.join(prefix,entry.name); if(entry.isDirectory()) files.push(...await walk(path.join(dir,entry.name),name)); else if(entry.isFile()) files.push(name);} return files;}
export async function packagePublic(root=process.cwd()) {
  const input=path.join(root,'out'), output=path.join(root,'dist');
  if(!(await readFile(path.join(input,'index.html'),'utf8')).includes('<html')) throw Error('Build the static export first');
  await rm(output,{recursive:true,force:true}); await mkdir(output,{recursive:true});
  const included=[],excluded=[];
  for(const file of await walk(input)) {
    if(!publishable(file)){excluded.push(file);continue;}
    const dest=path.join(output,file);await mkdir(path.dirname(dest),{recursive:true});
    if(file.endsWith('.html')) {
      let html=await readFile(path.join(input,file),'utf8');
      if(/<form\b/i.test(html)) throw Error('Public website contains a form: '+file);
      if(/(?:href|action)=["']\/(?:quote|onboarding|api|admin|staff|control)(?:[/?#"'])/i.test(html)) throw Error('Public website links to workspace: '+file);
      html=html.replace(/<head>/i,'<head><meta http-equiv="Content-Security-Policy" content="'+contentPolicy(html)+'">');
      await writeFile(dest,html);
    } else await copyFile(path.join(input,file),dest);
    included.push(file);
  }
  await writeFile(path.join(output,'.htaccess'),hostingRules);
  await mkdir(path.join(root,'artifacts'),{recursive:true});
  await writeFile(path.join(root,'artifacts/public-manifest.json'),JSON.stringify({included,excluded},null,2)+'\n');
  console.log('Public export: '+included.length+' files; excluded '+excluded.length+' private/source artifacts.');
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) await packagePublic();
