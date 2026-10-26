// Converts captured factories into ordinary CommonJS source, then bundles ESM.
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), crypto=require('node:crypto');
const parser=require('@babel/parser'), traverse=require('@babel/traverse').default, gen=require('@babel/generator').default,t=require('@babel/types');
const out=path.resolve(__dirname,'..'), capture=path.resolve(out,'../../team-showcase');
const manifest=JSON.parse(fs.readFileSync(path.join(capture,'manifest.json'))), factories={};
const context=vm.createContext({self:{webpackChunk_N_E:{push:entry=>Object.assign(factories,entry[1])}}});
for(const asset of manifest.assets.filter(a=>a.file.endsWith('.js')&&!a.file.includes('webpack-'))){try{vm.runInContext(fs.readFileSync(path.join(capture,'public',asset.file),'utf8'),context)}catch{}}
fs.mkdirSync(path.join(out,'src/dependencies'),{recursive:true});
const seen=new Set(), records=[], external={'12115':'react','95155':'react/jsx-runtime','59248':'react-dom/client'};
function convert(id){
 id=String(id);if(seen.has(id)||external[id])return; seen.add(id);
 if(!factories[id])throw Error('Missing factory '+id);
 const original=String(factories[id]);const ast=parser.parse('('+original+')');let factory;
 traverse(ast,{ArrowFunctionExpression(p){if(p.parentPath.isExpressionStatement()){factory=p;p.stop()}}});
 if(!factory)throw Error('Unknown factory '+id);
 const params=factory.node.params;
 // Binding-aware renaming preserves nested shadowed identifiers.
 if(params[0])factory.scope.rename(params[0].name,'module');
 if(params[1])factory.scope.rename(params[1].name,'exports');
 if(params[2]){
  factory.scope.rename(params[2].name,'bundleRequire');
  const refs=[...factory.scope.getBinding('bundleRequire').referencePaths];
  for(const ref of refs){
   const parent=ref.parentPath;
   if(parent.isCallExpression()&&parent.node.callee===ref.node){
    const arg=parent.node.arguments[0];if(!t.isNumericLiteral(arg))throw Error('Dynamic dependency in '+id);
    const dep=String(arg.value);convert(dep);
    parent.replaceWith(t.callExpression(t.identifier('require'),[t.stringLiteral(external[dep]|| (id==='67436'?'./dependencies/':'./')+dep+'.cjs')]));
   } else if(parent.isMemberExpression()) ref.replaceWith(t.identifier('interop'));
   else throw Error('Unsupported dependency reference in '+id);
  }
 }
 const body=gen(t.program(factory.node.body.body),{comments:true,compact:false}).code;
 const name=id==='67436'?'src/TeamShowcase.cjs':'src/dependencies/'+id+'.cjs';
 fs.writeFileSync(path.join(out,name),'// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.\nconst interop = require('+JSON.stringify(id==='67436'?'./interop.cjs':'../interop.cjs')+');\n'+body+'\n');
 records.push({id,file:name,capturedFactorySha256:crypto.createHash('sha256').update(original).digest('hex')});
}
convert('67436');
// Captured Next Image optimizers are disabled for local package assets.
const nextImageDependencies=path.join(out,'src/dependencies');
if(fs.existsSync(nextImageDependencies)){for(const file of fs.readdirSync(nextImageDependencies)){const filename=path.join(nextImageDependencies,file);if(!file.endsWith('.cjs'))continue;let source=fs.readFileSync(filename,'utf8');if(source.includes('path: \"/_next/image\"')){source=source.replace('path: \"/_next/image\"','path: \"\"').replace('unoptimized: !1','unoptimized: !0');fs.writeFileSync(filename,source);}}}

fs.writeFileSync(path.join(out,'src/interop.cjs'),"// Minimal Webpack export-interop semantics for already-resolved captured modules.\nexports.d = (target, definitions) => {\n  for (const key of Object.keys(definitions)) {\n    if (!Object.prototype.hasOwnProperty.call(target, key)) {\n      Object.defineProperty(target, key, { enumerable: true, get: definitions[key] });\n    }\n  }\n};\nexports.r = target => {\n  if (typeof Symbol !== \"undefined\" && Symbol.toStringTag) Object.defineProperty(target, Symbol.toStringTag, { value: \"Module\" });\n  Object.defineProperty(target, \"__esModule\", { value: true });\n};\nexports.n = value => {\n  const getter = value && value.__esModule ? () => value.default : () => value;\n  Object.defineProperty(getter, \"a\", { get: getter });\n  return getter;\n};\nexports.t = (value, mode, load) => {\n  if (mode & 1) {\n    if (typeof load !== \"function\") throw new Error(\"Webpack interop.t mode 1 needs a resolved-module loader\");\n    value = load(value);\n  }\n  if (mode & 8) return value;\n  if ((mode & 4) && value && typeof value === \"object\" && value.__esModule) return value;\n  const namespace = Object.create(null);\n  exports.r(namespace);\n  const definitions = Object.create(null);\n  definitions.default = () => value;\n  if ((mode & 2) && value != null && typeof value !== \"string\") {\n    for (const key in Object(value)) {\n      if (key !== \"default\" && !Object.prototype.hasOwnProperty.call(definitions, key)) {\n        definitions[key] = () => value[key];\n      }\n    }\n  }\n  exports.d(namespace, definitions);\n  return namespace;\n};\nexports.o = (object, property) => Object.prototype.hasOwnProperty.call(object, property);\nexports.g = globalThis;\nexports.nc = undefined;\n");
fs.writeFileSync(path.join(out,'src/index.js'),`import component from './TeamShowcase.cjs';\nexport const TeamShowcase = component.TeamShowcase;\nexport default TeamShowcase;\n`);
// Preserve production styles in original order, with fonts colocated and URLs relative.
fs.mkdirSync(path.join(out,'dist/fonts'),{recursive:true});let css='/* Captured Arc production styles, preserved in original order. */\n';
for(const asset of manifest.assets.filter(a=>a.file.endsWith('.css'))){css+=fs.readFileSync(path.join(capture,'public',asset.file),'utf8')+'\n';}
css=css.replace(/url\((['"]?)([^)'"\s]+)\1\)/g,(all,quote,url)=>{
 const file=url.split('/').pop();const asset=manifest.assets.find(a=>a.file.endsWith('/'+file));
 if(asset&&/\.woff2?$/.test(file)){fs.copyFileSync(path.join(capture,'public',asset.file),path.join(out,'dist/fonts',file));return 'url("./fonts/'+file+'")';}return all;
});
fs.writeFileSync(path.join(out,'dist/styles.css'),css);
fs.writeFileSync(path.join(out,'provenance.json'),JSON.stringify({source:manifest.source,capturedAt:manifest.capturedAt,entryModule:67436,method:'Binding-aware conversion of captured factories into CommonJS, bundled to ESM with host React external. No behavior/data substitutions.',modules:records},null,2));
console.log('Reconstructed '+seen.size+' modules.');
