"""Saves one full-resolution frame posted by `window.bmgCapture()` (src/ui/dev/capture.ts).

    python3 scripts/capture-receiver.py [output.jpg] [port]

Listens on 127.0.0.1 only, accepts a single JPEG data URL from the Vite dev server's origin,
writes it to the output path and exits.
"""
import base64
import http.server
import sys

OUTPUT = sys.argv[1] if len(sys.argv) > 1 else 'capture.jpg'
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8765
PREFIX = 'data:image/jpeg;base64,'
MAX_BYTES = 64 * 1024 * 1024


class Receiver(http.server.BaseHTTPRequestHandler):
    saved = False

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(min(length, MAX_BYTES)).decode('ascii', errors='replace')
        if not body.startswith(PREFIX):
            self.reply(400, b'expected a JPEG data URL')
            return
        with open(OUTPUT, 'wb') as out:
            out.write(base64.b64decode(body[len(PREFIX):]))
        Receiver.saved = True
        self.reply(200, b'ok')

    def reply(self, status, message):
        self.send_response(status)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(message)

    def log_message(self, *args):
        pass


server = http.server.HTTPServer(('127.0.0.1', PORT), Receiver)
print(f'waiting for a frame on http://127.0.0.1:{PORT}/ -> {OUTPUT}', flush=True)
while not Receiver.saved:
    server.handle_request()
print(f'saved {OUTPUT}')
