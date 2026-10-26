import {build} from 'esbuild';
import {writeFileSync, copyFileSync, cpSync, readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
// Bundle internal CommonJS first, then explicitly bridge the two host ESM imports.
const result=await build({absWorkingDir:root,entryPoints:['src/index.js'],bundle:true,write:false,format:'cjs',platform:'browser',target:'es2022',external:['react','react-dom','react/jsx-runtime'],legalComments:'inline',minify:false});
let code=result.outputFiles[0].text;
code=code.replace(/require\("react\/jsx-runtime"\)/g,'HostJSX').replace(/require\("react"\)/g,'HostReact');
if(/\brequire\(["']/.test(code))throw Error('Unresolved host dependency');
code=`import * as HostReact from 'react';\nimport * as HostJSX from 'react/jsx-runtime';\nconst module = {exports:{}};\n${code}\nconst PortableTeamShowcase = module.exports.TeamShowcase;\nexport {PortableTeamShowcase as TeamShowcase};\nexport default PortableTeamShowcase;\n`;
if (existsSync(root+'src/media-map.json')) {
 const mediaMap=JSON.parse(readFileSync(root+'src/media-map.json','utf8'));
 if (existsSync(root+'src/media')) cpSync(root+'src/media',root+'dist/media',{recursive:true});
 const mediaImports=[];
 const mediaVars=new Map();
 mediaMap.assets.forEach((asset,index)=>{const relative=asset.path.slice('/media/'.length);const variable=`__arcMedia${index}`;mediaVars.set(relative,variable);mediaImports.push(`import ${variable} from ${JSON.stringify('./media/'+relative)};`);});
 for (const sourcePath of mediaMap.literals) {
  const relative=sourcePath.slice('/media/'.length);
  if(mediaVars.has(relative)) code=code.split(JSON.stringify(sourcePath)).join(mediaVars.get(relative));
 }
 for (const template of mediaMap.dynamicTemplates) {
  const relPrefix=template.prefix.slice('/media/'.length);
  const lookup=mediaMap.assets.filter(a=>a.path.slice('/media/'.length).startsWith(relPrefix)&&a.path.endsWith(template.suffix));
  const object=Object.create(null);
  for(const asset of lookup){const relative=asset.path.slice('/media/'.length);const key=relative.slice(relPrefix.length,relative.length-template.suffix.length);object[key]=mediaVars.get(relative);}
  const sourceTemplate='`'+template.prefix+'${'+template.expression+'}'+template.suffix+'`';
  const replacement='('+JSON.stringify(object)+')['+template.expression+']';
  code=code.split(sourceTemplate).join(replacement);
 }
 for (const prefix of mediaMap.literals.filter(x=>!mediaVars.has(x.slice('/media/'.length)))) {
  const relPrefix=prefix.slice('/media/'.length);
  const matching=mediaMap.assets.filter(a=>a.path.slice('/media/'.length).startsWith(relPrefix));
  const declaration=new RegExp('\\b(?:var|let|const)\\s+(\\w+)\\s*=\\s*'+JSON.stringify(prefix).replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')+'\\s*;');
  const found=code.match(declaration);
  if(!found) throw new Error('Media prefix binding not found: '+prefix);
  const variable=found[1];
  for(const asset of matching){const relative=asset.path.slice('/media/'.length);const suffix=relative.slice(relPrefix.length);const sourceTemplate='`'+'${'+variable+'}'+suffix+'`';code=code.split(sourceTemplate).join(mediaVars.get(relative));}
  code=code.replace(declaration,found[0].replace(JSON.stringify(prefix),'""'));
 }
 if (code.includes('\"/media/') || code.includes("'/media/") || code.includes('`/media/') || code.includes('/_next/image')) throw new Error('Unrebased captured image URL in '+root);
 if(mediaImports.length) code=mediaImports.join('\n')+'\n'+code;
}
writeFileSync(root+'dist/index.js',code);

await build({absWorkingDir:root,entryPoints:['demo/main.jsx'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:root+'demo/app.js',assetNames:'media/[name]-[hash]',loader:{'.jpg':'file','.jpeg':'file','.png':'file','.webp':'file','.avif':'file','.gif':'file','.svg':'file'},legalComments:'inline'});

copyFileSync(root+'src/index.d.ts',root+'dist/index.d.ts');
