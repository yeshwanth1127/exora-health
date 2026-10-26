import path from 'node:path';
import { stat } from 'node:fs/promises';

/** Resolve exported Next pages without turning missing files into the homepage. */
export async function exportedPlatformPage(root: string, requestUrl: string): Promise<string | null> {
  let pathname: string;
  try { pathname = decodeURIComponent(requestUrl.split('?')[0]!); } catch { return null; }
  if (!pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('\0')) return null;
  const relative = pathname.replace(/^\/+|\/+$/g, '');
  if (relative.split('/').some(part => part === '.' || part === '..' || part.startsWith('.'))) return null;
  // API/admin URLs must never fall through to a marketing page.
  if (/^(control|admin)(\/|$)/.test(relative)) return null;
  const candidates = !relative ? ['index.html'] : path.extname(relative) ? [relative] : [`${relative}.html`, `${relative}/index.html`];
  for (const file of candidates) {
    if ((await stat(path.join(root,file)).catch(()=>null))?.isFile()) return file;
  }
  return null;
}
