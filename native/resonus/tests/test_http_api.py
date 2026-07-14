"""
HTTP API integration tests — run against both Go and Zig gateways.
No SIP/RTP or real OpenAI required.
"""
import pytest
import time


class TestHealth:
    def test_returns_200(self, gateway):
        r = gateway.get("/health")
        assert r.status_code == 200

    def test_is_json(self, gateway):
        r = gateway.get("/health")
        data = r.json()
        assert "ok" in data
        assert data["ok"] is True

    def test_has_deps_field(self, gateway):
        r = gateway.get("/health")
        data = r.json()
        assert "deps" in data or "store" in data  # Go has 'deps', Zig has both


class TestContextAPI:
    PHONE = "+79001234567"

    def test_set_context(self, gateway):
        r = gateway.post(f"/context/{self.PHONE}", json={"context": "говори кратко"})
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_get_context_after_set(self, gateway):
        gateway.post(f"/context/{self.PHONE}", json={"context": "test context value"})
        r = gateway.get(f"/context/{self.PHONE}")
        assert r.status_code == 200
        data = r.json()
        assert "test context value" in data.get("context", "")

    def test_get_missing_context_404(self, gateway):
        r = gateway.get("/context/+70000000000")
        assert r.status_code == 404

    def test_delete_context(self, gateway):
        gateway.post(f"/context/{self.PHONE}", json={"context": "to delete"})
        r = gateway.delete(f"/context/{self.PHONE}")
        assert r.status_code == 200
        # After delete, GET should 404
        r2 = gateway.get(f"/context/{self.PHONE}")
        assert r2.status_code == 404

    def test_update_context(self, gateway):
        gateway.post(f"/context/{self.PHONE}", json={"context": "first"})
        gateway.post(f"/context/{self.PHONE}", json={"context": "second"})
        r = gateway.get(f"/context/{self.PHONE}")
        assert "second" in r.json().get("context", "")

    def test_empty_key_400(self, gateway):
        r = gateway.post("/context/", json={"context": "x"})
        assert r.status_code in (400, 404)

    def test_missing_context_field_400(self, gateway):
        r = gateway.post(f"/context/{self.PHONE}", json={"wrong_field": "x"})
        assert r.status_code == 400


class TestSessionsAPI:
    def test_list_sessions_returns_array(self, gateway):
        r = gateway.get("/sessions")
        # May fail with 503 if store not configured — that's OK
        if r.status_code == 503:
            pytest.skip("store not configured")
        assert r.status_code == 200
        data = r.json()
        assert "sessions" in data
        assert isinstance(data["sessions"], list)

    def test_user_sessions_returns_array(self, gateway):
        r = gateway.get("/user/+79001234567")
        if r.status_code == 503:
            pytest.skip("store not configured")
        assert r.status_code == 200
        data = r.json()
        assert "sessions" in data

    def test_record_nonexistent_404(self, gateway):
        r = gateway.get("/record/nonexistent-session-id/user")
        if r.status_code == 503:
            pytest.skip("store not configured")
        assert r.status_code == 404

    def test_record_bad_source_400(self, gateway):
        r = gateway.get("/record/some-session/badSource")
        if r.status_code == 503:
            pytest.skip("store not configured")
        assert r.status_code == 400

    def test_transcript_nonexistent_empty(self, gateway):
        r = gateway.get("/transcript/nonexistent-session-id")
        if r.status_code == 503:
            pytest.skip("store not configured")
        assert r.status_code == 200
        data = r.json()
        assert "transcript" in data
        assert data["transcript"] == []

    def test_delete_record_nonexistent_ok(self, gateway):
        r = gateway.delete("/record/nonexistent-session-id")
        if r.status_code == 503:
            pytest.skip("store not configured")
        assert r.status_code == 200

    def test_delete_transcript_nonexistent_ok(self, gateway):
        r = gateway.delete("/transcript/nonexistent-session-id")
        if r.status_code == 503:
            pytest.skip("store not configured")
        assert r.status_code == 200


class TestSignalAPI:
    def test_signal_openai_without_key_error(self, gateway):
        """Without OPENAI_API_KEY the signal endpoint should fail with a clear error."""
        r = gateway.post("/signal/openai", json={"offer_sdp": "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n"})
        # Should be 4xx or 5xx, not 200
        assert r.status_code != 200 or "error" in r.json()

    def test_signal_bad_json_400(self, gateway):
        r = gateway.post("/signal/openai", data="not json", headers={"content-type": "application/json"})
        assert r.status_code == 400

    def test_gemini_missing_offer_handled(self, gateway):
        r = gateway.post("/signal/gemini", json={})
        # Gemini doesn't require offer SDP — should not 500
        assert r.status_code in (200, 400, 503)

    def test_unknown_route_404(self, gateway):
        r = gateway.get("/does-not-exist")
        assert r.status_code == 404

    def test_wrong_method_405(self, gateway):
        r = gateway.delete("/signal/openai")
        assert r.status_code in (404, 405)


class TestResponseShape:
    """Verify both gateways return same JSON shape for key endpoints."""

    def test_health_shape(self, gateway):
        data = gateway.get("/health").json()
        assert isinstance(data.get("ok"), bool)

    def test_sessions_shape(self, gateway):
        r = gateway.get("/sessions")
        if r.status_code == 503:
            pytest.skip("store not configured")
        data = r.json()
        assert "ok" in data
        assert "sessions" in data

    def test_context_set_shape(self, gateway):
        r = gateway.post("/context/+71234567890", json={"context": "test"})
        data = r.json()
        assert "ok" in data

    def test_transcript_shape(self, gateway):
        r = gateway.get("/transcript/fake-id")
        if r.status_code == 503:
            pytest.skip("store not configured")
        data = r.json()
        assert "ok" in data
        assert "transcript" in data
        assert isinstance(data["transcript"], list)
