// Rebuild the social image from the same one-line product-name config.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {transpileModule} from 'typescript';
const require=createRequire(import.meta.url);
const sharp=require(require.resolve('sharp',{paths:[require.resolve('next/package.json')]}));
const code=transpileModule(await readFile(new URL('../src/lib/brand.ts',import.meta.url),'utf8'),{compilerOptions:{module:99,target:99}}).outputText;
const {BRAND_NAME}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const name=escape(BRAND_NAME);const font=BRAND_NAME.length>18?54:72;
const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="white"/><rect x="32" y="32" width="1136" height="566" rx="32" fill="#f0f7fe"/><text x="92" y="150" font-family="sans-serif" font-size="${font}" font-weight="700" fill="#171b20">${name}</text><text x="92" y="292" font-family="sans-serif" font-size="66" font-weight="700" letter-spacing="-2" fill="#171b20">A clearer clinic day.</text><text x="92" y="378" font-family="sans-serif" font-size="66" font-weight="700" letter-spacing="-2" fill="#171b20">More time for care.</text><text x="92" y="482" font-family="sans-serif" font-size="25" fill="#55728d">AI reception · Appointments · Patient conversations</text><rect x="92" y="526" width="120" height="7" rx="3" fill="#0875de"/></svg>`);
await sharp(svg).png().toFile(new URL('../public/social-card.png',import.meta.url).pathname);
