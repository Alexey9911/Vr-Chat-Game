#!/usr/bin/env python3
# Tiny upload sink: viewer POSTs a JPEG dataURL to /save?name=X -> meshy_output/captures/X.jpg
from http.server import BaseHTTPRequestHandler, HTTPServer
import base64, urllib.parse, os
OUT = "meshy_output/captures"; os.makedirs(OUT, exist_ok=True)
class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
    def do_OPTIONS(self):
        self.send_response(200); self._cors(); self.end_headers()
    def do_POST(self):
        q = urllib.parse.urlparse(self.path)
        name = urllib.parse.parse_qs(q.query).get('name', ['cap'])[0]
        n = int(self.headers.get('Content-Length', 0))
        data = self.rfile.read(n).decode('utf-8', 'ignore')
        try:
            b64 = data.split(',', 1)[1]
            open(os.path.join(OUT, name + '.jpg'), 'wb').write(base64.b64decode(b64))
            print('saved', name, flush=True)
        except Exception as e:
            print('err', e, flush=True)
        self.send_response(200); self._cors(); self.end_headers(); self.wfile.write(b'ok')
    def log_message(self, *a): pass
print('capture server on 8200', flush=True)
HTTPServer(('127.0.0.1', 8200), H).serve_forever()
