import { splitLocale,isLocale,localizedPath } from './lib/i18n/config';
import { NextRequest, NextResponse } from 'next/server';
import { SEARCH_ENABLED } from './lib/site';
import { runtimeContentPolicy, searchHeader } from './lib/crawl-policy';

export function middleware(request: NextRequest) {
  if (process.env.CAPTURE_STATIC_EXPORT === '1') return NextResponse.next();
  const path = request.nextUrl.pathname;
  // The control API owns authenticated setup and accepts its own write methods.
  if (path === '/control' || path.startsWith('/control/')) return NextResponse.next();
  if (!['GET', 'HEAD'].includes(request.method)) return new NextResponse(null, {status:405,headers:{Allow:'GET, HEAD'}});
  if (/^\/(?:api|admin|staff)(?:[/.]|$)/i.test(path) || path.split('/').some(part => part.startsWith('.')) || /\.(?:map|env|zip|bak|sql|ya?ml|toml)$/i.test(path)) return new NextResponse(null,{status:404});
  const preferred=request.cookies.get('capture-language')?.value;
  if(path==='/'&&request.nextUrl.searchParams.get('lang')!=='en'&&preferred&&isLocale(preferred)&&preferred!=='en'){
    const target=request.nextUrl.clone();target.pathname=localizedPath(preferred,'/');
    const redirect=NextResponse.redirect(target,307);redirect.headers.set('Cache-Control','private, no-store');redirect.headers.set('Vary','Cookie');return redirect;
  }
  const nonce = btoa(crypto.randomUUID());
  const policy = runtimeContentPolicy(nonce, process.env.NODE_ENV !== 'production');
  const headers = new Headers(request.headers);
  // Overwrite client-supplied values; Next uses this request CSP to nonce SSR scripts.
  headers.set('x-nonce', nonce);
  headers.set('x-site-language',splitLocale(path).locale);
  headers.set('Content-Security-Policy', policy);
  const response = NextResponse.next({request:{headers}});
  response.headers.set('Content-Security-Policy', policy);
  response.headers.set('X-Robots-Tag', searchHeader(path, SEARCH_ENABLED));
  response.headers.set('X-Content-Type-Options','nosniff');
  response.headers.set('X-Frame-Options','SAMEORIGIN');
  response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=()');
  response.headers.set('X-Capture-Render','ssr');
  return response;
}
export const config = {matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
