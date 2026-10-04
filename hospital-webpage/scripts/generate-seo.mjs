import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ts from 'typescript';

const output = resolve('dist');
const approved = process.env.VITE_SEO_APPROVED === 'verified-content-and-clinic';

if (!approved) {
  console.log('SEO launch gate is closed: preview pages remain noindex; no public sitemap generated.');
  process.exit(0);
}
const siteUrl = new URL(process.env.VITE_SITE_URL || 'https://invalid.example');
if (
  !process.env.VITE_SITE_URL || siteUrl.protocol !== 'https:' ||
  siteUrl.pathname !== '/' || siteUrl.search || siteUrl.hash || siteUrl.username || siteUrl.password ||
  /(^localhost$|\.localhost$|\.example$|\.test$|(^|\.)example\.(com|net|org)$|^127\.)/i.test(siteUrl.hostname)
) {
  throw new Error('VITE_SITE_URL must be the verified public HTTPS origin, without a path or query.');
}

async function loadDataModule(path) {
  const source = await readFile(resolve(path), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

const { departments } = await loadDataModule('src/data/departments.ts');
const { doctors } = await loadDataModule('src/data/doctors.ts');
const { branches } = await loadDataModule('src/data/branches.ts');
const paths = [
    '/',
    '/departments/',
    ...departments.map(({ id }) => `/departments/${encodeURIComponent(id)}/`),
    '/doctors/',
    ...doctors.map(({ id }) => `/doctors/${encodeURIComponent(id)}/`),
    '/locations/',
    ...branches.map(({ id }) => `/locations/${encodeURIComponent(id)}/`),
    '/faq/',
    '/insurance-pricing/',
    '/how-it-works/',
    '/contact/',
  ];
// A Vite SPA serves one generic shell. The launch requires route-specific HTML
// before any URL can be advertised to search crawlers.
for (const path of paths) {
  const htmlPath = path === '/' ? resolve(output, 'index.html') : resolve(output, path.slice(1), 'index.html');
  const html = await readFile(htmlPath, 'utf8').catch(() => {
    throw new Error(`SEO launch blocked: ${path} has no prerendered HTML at ${htmlPath}.`);
  });
  const canonical = new URL(path, siteUrl).href;
  if (
    !/<main\b/i.test(html) || !/<h1\b/i.test(html) ||
    !/<meta\s+name=["']robots["']\s+content=["']index,follow["']/i.test(html) ||
    !html.includes(`href="${canonical}"`) ||
    /<meta\s+name=["']robots["']\s+content=["']noindex/i.test(html)
  ) {
    throw new Error(`SEO launch blocked: ${path} needs visible page content, an index directive, and its own canonical URL in the first HTML response.`);
  }
}
const escapeXml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const urls = paths.map(path => `  <url><loc>${escapeXml(new URL(path, siteUrl).href)}</loc></url>`).join('\n');
await writeFile(resolve(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
await writeFile(resolve(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl.origin}/sitemap.xml\n`);
console.log(`SEO sitemap generated for ${paths.length} verified, prerendered pages at ${siteUrl.origin}.`);
