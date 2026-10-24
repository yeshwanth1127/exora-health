/** Public marketing pages are readable; personalized results and previews stay out of search. */
export function privateSearchRoute(path: string) {
  return /^\/(?:business-report|business-lookup|demo|quote|onboarding|website-templates|api|admin|staff|control)(?:[/.]|$)/i.test(path);
}
export function searchHeader(path: string, enabled: boolean) {
  return !enabled || privateSearchRoute(path) ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
}
export function runtimeContentPolicy(nonce: string, development = false) {
  return ["default-src 'self'", `script-src 'self' 'nonce-${nonce}'${development ? " 'unsafe-eval'" : ''}`, "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https:", "font-src 'self' data:", "worker-src 'self' blob:", `connect-src 'self' https://tiles.openfreemap.org https://us.i.posthog.com https://eu.i.posthog.com${development ? ' ws: wss:' : ''}`, "frame-src 'self'", "frame-ancestors 'self'", "media-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'none'"].join('; ');
}
