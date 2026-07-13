#!/usr/bin/env python3
"""Minimal Tier-3 target for the Command Injection lab (~30-40 MB image).

DELIBERATELY VULNERABLE: the /ping endpoint concatenates user input into a shell
command. This runs ONLY inside a per-user, 128MB-capped, read-only, network=none,
gVisor-sandboxed container (see ContainerManager). Do NOT ship this outside that box.
"""
import os
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

BANNER = b"NIELIT cmdi target :: try  host=127.0.0.1;id  on /ping\n"


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self._send(200, BANNER)
            return
        if parsed.path == "/ping":
            host = parse_qs(parsed.query).get("host", ["127.0.0.1"])[0]
            # ⚠️ INTENTIONALLY VULNERABLE: unsanitized input into a shell.
            cmd = f"ping -c 1 {host}"
            try:
                out = subprocess.run(cmd, shell=True, capture_output=True, timeout=5)
                body = out.stdout + out.stderr
            except Exception as exc:  # noqa: BLE001
                body = str(exc).encode()
            self._send(200, body or b"(no output)\n")
            return
        self._send(404, b"not found\n")

    def _send(self, code, body):
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):  # quiet
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
