"""Serve only the independent flow artifact; never expose the repository."""
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit

FILE = Path(__file__).resolve().parent / 'TOK.html'

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if urlsplit(self.path).path not in ('/', '/TOK.html'):
            self.send_error(404)
            return
        data = FILE.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass

print('Independent flow study: http://127.0.0.1:8880/TOK.html', flush=True)
HTTPServer(('127.0.0.1', 8880), Handler).serve_forever()
