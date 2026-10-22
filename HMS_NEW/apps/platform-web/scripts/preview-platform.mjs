// Local static preview with the same exported-page routing as the control API.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const root = resolve(import.meta.dirname, '../dist');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.woff2':'font/woff2', '.json':'application/json' };
createServer(async (req,res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path.startsWith('/control/')) { res.writeHead(503, {'content-type':'application/json'});res.end(JSON.stringify({message:'Run platform:dev with the local control API to create a workspace.'}));return; }
    const base = resolve(root, `.${path}`);
    if (!base.startsWith(root + '/') && base !== root) throw new Error();
    let file;
    for (const candidate of [base, `${base}.html`, resolve(base,'index.html')]) { if ((await stat(candidate).catch(()=>null))?.isFile()) { file=candidate;break; } }
    if (!file) {res.writeHead(404,{'content-type':'text/html'});res.end(await readFile(resolve(root,'404.html')));return;}
    res.writeHead(200,{'content-type':types[extname(file)] || 'application/octet-stream'});res.end(await readFile(file));
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.PORT || 5190), '127.0.0.1',()=>console.log('Platform preview at http://127.0.0.1:'+(process.env.PORT||5190)));
