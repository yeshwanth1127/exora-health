import {build} from 'esbuild';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const interopSource=readFileSync(root+'src/interop.cjs','utf8');
for(const api of ['exports.t','exports.o']) if(!interopSource.includes(api)) throw new Error('Missing Webpack interop helper '+api);
const provenance=JSON.parse(readFileSync(root+'provenance.json','utf8'));
const assetKeys=(provenance.assets||[]).map(asset=>'/'+asset.file);
const exportName=provenance.export;
const result=await build({absWorkingDir:root,entryPoints:['src/index.js'],bundle:true,write:false,format:'cjs',platform:'browser',target:'es2022',external:['react','react-dom','react/jsx-runtime'],legalComments:'inline',minify:false});
let bundled=result.outputFiles[0].text;
bundled=bundled.replace(/require\("react\/jsx-runtime"\)/g,'HostJSX').replace(/require\("react"\)/g,'HostReact');
if(/\brequire\(["']/.test(bundled)) throw new Error('Unresolved host dependency');
const bridge=`import * as HostReactBase from 'react';
import * as HostJSXBase from 'react/jsx-runtime';
const module={exports:{}};
const PortableAssetBase=new URL('./assets/',import.meta.url).href;
const PortableAssetKeys=${JSON.stringify(assetKeys)};
function __assetUrl(value){if(typeof value!=='string')return value;try{let u=new URL(value,PortableAssetBase),p=u.pathname;if(p==='/_next/image'){const src=u.searchParams.get('url');if(src)p=new URL(src,PortableAssetBase).pathname}let match=PortableAssetKeys.find(k=>p===k||p.endsWith(k));if(!match){const base=p.slice(p.lastIndexOf('/')+1),candidates=PortableAssetKeys.filter(k=>k.slice(k.lastIndexOf('/')+1)===base);if(candidates.length===1)match=candidates[0]}return match?new URL(match.slice(1),PortableAssetBase).href:value}catch{return value}}
function rebaseProps(type,props){if(!props)return props;const p={...props};if(type==='img'){if(typeof p.src==='string')p.src=__assetUrl(p.src);if(typeof p.srcSet==='string')p.srcSet=p.srcSet.split(',').map(x=>{const [url,...rest]=x.trim().split(/\s+/);return [__assetUrl(url),...rest].join(' ')}).join(', ')}if(p.style&&typeof p.style.backgroundImage==='string')p.style={...p.style,backgroundImage:p.style.backgroundImage.replace(/url\(([^)]+)\)/g,(m,u)=>'url("'+__assetUrl(u.replace(/^['"]|['"]$/g,''))+'")')};return p}
const HostReact=new Proxy(HostReactBase,{get(target,key){if(key==='createElement')return(type,props,...children)=>target.createElement(type,rebaseProps(type,props),...children);return Reflect.get(target,key)}});
const HostJSX=new Proxy(HostJSXBase,{get(target,key){if(key==='jsx'||key==='jsxs')return(type,props,elementKey)=>target[key](type,rebaseProps(type,props),elementKey);return Reflect.get(target,key)}});
`;
const code=bridge+bundled+`\nconst PublicComponent=module.exports[${JSON.stringify(exportName)}];\nexport {PublicComponent as ${exportName}};\nexport default PublicComponent;\n`;
writeFileSync(root+'dist/index.js',code);
