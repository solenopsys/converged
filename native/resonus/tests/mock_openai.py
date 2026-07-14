"""
Mock OpenAI /v1/realtime/calls endpoint.
Accepts multipart SDP offer, returns a minimal SDP answer.
Optionally emits transcript events via a WebSocket (not implemented here —
the Zig server connects to libdatachannel data channel, not to us directly).
"""
import threading
import email
import email.policy
from http.server import HTTPServer, BaseHTTPRequestHandler
from io import BytesIO

# Minimal SDP answer that will cause ICE to fail gracefully (loopback)
# The Zig bridge will try to connect, fail ICE, and surface IceConnectionTimeout.
FAKE_SDP_ANSWER = """\
v=0
o=- 1234567890 1234567890 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0
a=extmap-allow-mixed
m=audio 9 UDP/TLS/RTP/SAVPF 111
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:mock
a=ice-pwd:mockpasswordfortesting1234
a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99
a=setup:active
a=mid:0
a=sendrecv
a=rtpmap:111 opus/48000/2
a=rtcp-fb:111 transport-cc
a=fmtp:111 minptime=10;useinbandfec=1
"""


class MockOpenAIHandler(BaseHTTPRequestHandler):
    """Handles POST /v1/realtime/calls — returns fake SDP answer."""

    received_requests: list = []

    def do_POST(self):
        if not self.path.startswith("/v1/realtime/calls"):
            self.send_response(404)
            self.end_headers()
            return

        length = int(self.headers.get("content-length", 0))
        body = self.rfile.read(length)

        # Parse multipart to extract sdp and session fields
        ct = self.headers.get("content-type", "")
        parsed = _parse_multipart(ct, body)
        MockOpenAIHandler.received_requests.append(parsed)

        answer = FAKE_SDP_ANSWER.encode()
        self.send_response(200)
        self.send_header("content-type", "application/sdp")
        self.send_header("content-length", str(len(answer)))
        self.end_headers()
        self.wfile.write(answer)

    def log_message(self, fmt, *args):
        pass  # silence


def _parse_multipart(content_type: str, body: bytes) -> dict:
    """Parse multipart/form-data body into dict of field_name → value."""
    msg_bytes = f"Content-Type: {content_type}\r\n\r\n".encode() + body
    msg = email.message_from_bytes(msg_bytes, policy=email.policy.compat32)
    result = {}
    if msg.is_multipart():
        for part in msg.get_payload():
            cd = part.get("Content-Disposition", "")
            name = None
            for item in cd.split(";"):
                item = item.strip()
                if item.startswith("name="):
                    name = item[5:].strip('"')
            if name:
                result[name] = part.get_payload(decode=False)
    return result


class MockOpenAIServer:
    def __init__(self, host="127.0.0.1", port=19876):
        self.host = host
        self.port = port
        self._server = HTTPServer((host, port), MockOpenAIHandler)
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)

    def start(self):
        MockOpenAIHandler.received_requests.clear()
        self._thread.start()

    def stop(self):
        self._server.shutdown()

    @property
    def url(self):
        return f"http://{self.host}:{self.port}/v1/realtime/calls"

    @property
    def received(self):
        return MockOpenAIHandler.received_requests
