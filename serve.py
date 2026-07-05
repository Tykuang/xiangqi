"""Tiny static file server with no-cache headers — used to bypass
the browser cache during development of the Xiangqi project."""
import http.server
import socketserver
import sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

class ReusableTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with ReusableTCPServer(('', port), NoCacheHandler) as httpd:
        print(f'serving with no-cache on port {port}', flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
