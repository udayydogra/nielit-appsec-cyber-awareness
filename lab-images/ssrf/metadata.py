#!/usr/bin/env python3
"""Mock cloud metadata service on 127.0.0.1:8080. With the container run under
--network none, loopback still works but the real internet / 169.254.169.254 do
not — so this stands in for the internal-only metadata endpoint an SSRF would reach."""
from http.server import BaseHTTPRequestHandler, HTTPServer

CREDS = (
    '{\n'
    '  "Code": "Success",\n'
    '  "AccessKeyId": "AKIAI44QH8DHBEXAMPLE",\n'
    '  "SecretAccessKey": "wJalrXUtnFEMI/flag{ssrf_reached_cloud_metadata}",\n'
    '  "Token": "FQoGZXIvYXdzE...",\n'
    '  "Expiration": "2030-01-01T00:00:00Z"\n'
    '}\n'
).encode()


class H(BaseHTTPRequestHandler):
    def do_GET(self):
        if "meta-data" in self.path or "security-credentials" in self.path:
            body = CREDS
        elif self.path == "/":
            body = b"internal metadata service (simulates 169.254.169.254 on loopback)\n"
        else:
            body = b"404\n"
        self.send_response(200)
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 8080), H).serve_forever()
