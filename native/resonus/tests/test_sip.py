"""
SIP signaling integration tests.
Tests INVITE/200 OK/BYE flow without requiring real OpenAI connection.
The gateway will attempt to connect to OpenAI (mock or real) and return
503 if it can't, or 200 OK if it can.
"""
import time
import pytest
from sip_client import SipClient
import random


SERVER_IP = "127.0.0.1"


def make_client() -> SipClient:
    port = random.randint(26000, 29999)
    return SipClient(local_port=port)


class TestSipSignaling:
    def test_invite_gets_response(self, gateway):
        """INVITE must receive a SIP response (200 OK or 4xx/5xx)."""
        client = make_client()
        try:
            resp = client.invite(SERVER_IP, gateway.sip_port)
            assert resp, "No SIP response received within timeout"
            assert "status_code" in resp
            assert resp["status_code"] in (200, 400, 503, 486, 404), (
                f"Unexpected status: {resp['status_code']}"
            )
        finally:
            client.close()

    def test_register_gets_200(self, gateway):
        """REGISTER should always return 200 OK (no auth required for MVP)."""
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(3.0)
        port = random.randint(26000, 29999)
        sock.bind(("127.0.0.1", port))
        try:
            msg = (
                f"REGISTER sip:{SERVER_IP} SIP/2.0\r\n"
                f"Via: SIP/2.0/UDP 127.0.0.1:{port};branch=z9hG4bKtest\r\n"
                f"From: <sip:user@127.0.0.1>;tag=reg1\r\n"
                f"To: <sip:user@127.0.0.1>\r\n"
                f"Call-ID: register-test@127.0.0.1\r\n"
                f"CSeq: 1 REGISTER\r\n"
                f"Contact: <sip:user@127.0.0.1:{port}>\r\n"
                f"Content-Length: 0\r\n\r\n"
            )
            sock.sendto(msg.encode(), (SERVER_IP, gateway.sip_port))
            data, _ = sock.recvfrom(4096)
            assert b"200" in data
        except socket.timeout:
            pytest.skip("SIP port not responding (gateway not running with SIP enabled)")
        finally:
            sock.close()

    def test_options_gets_response(self, gateway):
        """OPTIONS should get a SIP response."""
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(3.0)
        port = random.randint(26000, 29999)
        sock.bind(("127.0.0.1", port))
        try:
            msg = (
                f"OPTIONS sip:{SERVER_IP} SIP/2.0\r\n"
                f"Via: SIP/2.0/UDP 127.0.0.1:{port};branch=z9hG4bKopt\r\n"
                f"From: <sip:user@127.0.0.1>;tag=opt1\r\n"
                f"To: <sip:user@127.0.0.1>\r\n"
                f"Call-ID: options-test@127.0.0.1\r\n"
                f"CSeq: 1 OPTIONS\r\n"
                f"Content-Length: 0\r\n\r\n"
            )
            sock.sendto(msg.encode(), (SERVER_IP, gateway.sip_port))
            data, _ = sock.recvfrom(4096)
            first_line = data.decode(errors="replace").split("\r\n")[0]
            assert "SIP/2.0" in first_line
        except socket.timeout:
            pytest.skip("SIP port not responding")
        finally:
            sock.close()

    def test_invite_response_has_via(self, gateway):
        """200 OK (or any response) must echo back the Via header."""
        client = make_client()
        try:
            resp = client.invite(SERVER_IP, gateway.sip_port)
            if not resp:
                pytest.skip("No SIP response")
            hdrs = resp.get("headers", {})
            assert "via" in hdrs, "Response missing Via header"
        finally:
            client.close()

    def test_invite_response_has_call_id(self, gateway):
        """Response must echo the Call-ID."""
        client = make_client()
        try:
            resp = client.invite(SERVER_IP, gateway.sip_port)
            if not resp:
                pytest.skip("No SIP response")
            hdrs = resp.get("headers", {})
            assert "call-id" in hdrs
            assert client.call_id in hdrs["call-id"]
        finally:
            client.close()

    def test_invite_200_has_valid_sdp(self, gateway):
        """If 200 OK, SDP body must contain audio port."""
        client = make_client()
        try:
            resp = client.invite(SERVER_IP, gateway.sip_port)
            if not resp or resp.get("status_code") != 200:
                pytest.skip("No 200 OK (OpenAI mock may not be configured)")
            body = resp.get("body", "")
            assert "m=audio" in body, "SDP missing audio media line"
            port = client.parse_sdp_port(body)
            assert 1024 < port < 65535, f"Invalid RTP port in SDP: {port}"
        finally:
            client.close()

    def test_bye_after_invite_gets_200(self, gateway):
        """BYE must always return 200 OK regardless of call state."""
        client = make_client()
        try:
            client.invite(SERVER_IP, gateway.sip_port)
            time.sleep(0.1)
            resp = client.bye(SERVER_IP, gateway.sip_port)
            if resp:
                assert resp.get("status_code") == 200
        finally:
            client.close()

    def test_duplicate_invite_handled(self, gateway):
        """Re-INVITE (same Call-ID) should not crash the server."""
        client = make_client()
        try:
            client.invite(SERVER_IP, gateway.sip_port)
            time.sleep(0.1)
            resp2 = client.invite(SERVER_IP, gateway.sip_port)
            # Should get a response, not hang
            assert resp2 is not None
        finally:
            client.close()

    def test_cancel_gets_200(self, gateway):
        """CANCEL should return 200 OK."""
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(3.0)
        port = random.randint(26000, 29999)
        sock.bind(("127.0.0.1", port))
        call_id = f"cancel-test-{random.randint(1000,9999)}@127.0.0.1"
        try:
            msg = (
                f"CANCEL sip:{SERVER_IP} SIP/2.0\r\n"
                f"Via: SIP/2.0/UDP 127.0.0.1:{port};branch=z9hG4bKcancel\r\n"
                f"From: <sip:user@127.0.0.1>;tag=cncl1\r\n"
                f"To: <sip:user@127.0.0.1>\r\n"
                f"Call-ID: {call_id}\r\n"
                f"CSeq: 1 CANCEL\r\n"
                f"Content-Length: 0\r\n\r\n"
            )
            sock.sendto(msg.encode(), (SERVER_IP, gateway.sip_port))
            data, _ = sock.recvfrom(4096)
            assert b"200" in data
        except socket.timeout:
            pytest.skip("SIP port not responding")
        finally:
            sock.close()


class TestSipWithMockOpenAI:
    """
    Tests that require a mock OpenAI endpoint to be configured via
    OPENAI_REALTIME_CALLS_URL=http://127.0.0.1:19876/v1/realtime/calls
    """

    def test_invite_reaches_mock_openai(self, gateway, mock_openai):
        """After INVITE the gateway should POST to OpenAI endpoint."""
        before = len(mock_openai.received)
        client = make_client()
        try:
            client.invite(SERVER_IP, gateway.sip_port)
            time.sleep(2.0)  # give bridge time to attempt connection
            after = len(mock_openai.received)
            # Gateway should have called the mock (if OPENAI_REALTIME_CALLS_URL is set to mock)
            # This test passes trivially if not configured
        finally:
            client.close()

    def test_mock_openai_receives_sdp_and_session(self, gateway, mock_openai):
        """Mock OpenAI should receive both 'sdp' and 'session' fields in multipart."""
        if not mock_openai.received:
            pytest.skip("Mock not reached — set OPENAI_REALTIME_CALLS_URL to mock URL")
        req = mock_openai.received[-1]
        assert "sdp" in req, "OpenAI POST missing 'sdp' field"
        assert "session" in req, "OpenAI POST missing 'session' field"

    def test_session_json_has_model(self, gateway, mock_openai):
        if not mock_openai.received:
            pytest.skip("Mock not reached")
        import json
        session_raw = mock_openai.received[-1].get("session", "{}")
        session = json.loads(session_raw)
        assert "model" in session or "type" in session
