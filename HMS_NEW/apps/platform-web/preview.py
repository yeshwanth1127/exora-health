"""Loopback-only verification of the sanitized export; production uses Hostinger."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote
import argparse
import re
import json
import os
from business_lookup import lookup, LookupError

class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True

class ExportHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        route = unquote(urlsplit(self.path).path)
        if route == '/business-lookup':
            origin = self.headers.get('Origin')
            allowed_origins = {'http://' + self.headers.get('Host', '')}
            allowed_origins.update(value.rstrip('/') for value in [os.environ.get('CAPTURE_WEB_ORIGIN', ''), os.environ.get('NEXT_PUBLIC_SITE_ORIGIN', '')] if value)
            if (origin and origin not in allowed_origins) or self.headers.get('Sec-Fetch-Site') == 'cross-site':
                self.send_error(403)
                return
            try:
                payload, status = lookup(urlsplit(self.path).query), 200
            except LookupError as error:
                payload, status = {'error': {'code': error.code, 'message': error.message}}, error.status
            data = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if getattr(self.server, 'api_only', False):
            self.send_error(404)
            return
        if re.match(r'^/(quote|onboarding|api|admin|staff|control)([/.]|$)', route, re.I) or any(p.startswith('.') for p in route.split('/') if p):
            self.send_error(404)
            return
        super().do_GET()

    def log_request(self, code='-', size='-'):
        # Avoid retaining submitted business searches in the terminal request log.
        if urlsplit(self.path).path != '/business-lookup':
            super().log_request(code, size)

    def do_POST(self):
        self.send_error(405)
    do_PUT = do_PATCH = do_DELETE = do_OPTIONS = do_POST

    def list_directory(self, path):
        self.send_error(404)
        return None

    def end_headers(self):
        for key, value in {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN',
            'Content-Security-Policy': "frame-ancestors 'self'",
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
            'X-Robots-Tag': 'noindex, nofollow',
        }.items():
            self.send_header(key, value)
        super().end_headers()

    def translate_path(self, path):
        target = Path(super().translate_path(path))
        if not target.suffix and target.with_suffix('.html').is_file():
            return str(target.with_suffix('.html'))
        return str(target)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4488)
    parser.add_argument('--api-only', action='store_true')
    args = parser.parse_args()
    output = Path(__file__).resolve().parent / 'dist'
    if not args.api_only and not (output / 'index.html').exists():
        raise SystemExit('Run npm run build:public first.')
    server = PreviewServer(('127.0.0.1', args.port), partial(ExportHandler, directory=str(output)))
    server.api_only = args.api_only
    print(f'Website: http://127.0.0.1:{args.port}', flush=True)
    server.serve_forever()
