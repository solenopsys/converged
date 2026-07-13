"""
Cross-implementation comparison tests.
Runs the same scenarios against Go and Zig and verifies responses are equivalent.
Requires both gateways running: RUN_GO=1 RUN_ZIG=1.
"""
import os
import pytest
import requests

GO_HTTP = int(os.environ.get("GO_HTTP_PORT", 8081))
ZIG_HTTP = int(os.environ.get("ZIG_HTTP_PORT", 8090))
RUN_BOTH = os.environ.get("RUN_GO", "0") == "1" and os.environ.get("RUN_ZIG", "1") == "1"


def skip_if_not_both():
    if not RUN_BOTH:
        pytest.skip("Set RUN_GO=1 and RUN_ZIG=1 to run comparison tests")


def go(path: str, method="GET", **kw) -> requests.Response:
    return requests.request(method, f"http://127.0.0.1:{GO_HTTP}{path}", timeout=5, **kw)


def zig(path: str, method="GET", **kw) -> requests.Response:
    return requests.request(method, f"http://127.0.0.1:{ZIG_HTTP}{path}", timeout=5, **kw)


class TestCompareHealth:
    def test_both_healthy(self):
        skip_if_not_both()
        gr = go("/health")
        zr = zig("/health")
        assert gr.status_code == 200
        assert zr.status_code == 200
        assert gr.json()["ok"] is True
        assert zr.json()["ok"] is True


class TestCompareContext:
    PHONE = "+79009998877"

    def test_set_returns_ok(self):
        skip_if_not_both()
        payload = {"context": "compare test context"}
        gr = go(f"/context/{self.PHONE}", method="POST", json=payload)
        zr = zig(f"/context/{self.PHONE}", method="POST", json=payload)
        assert gr.status_code == zr.status_code == 200
        assert gr.json()["ok"] is True
        assert zr.json()["ok"] is True

    def test_get_returns_same_value(self):
        skip_if_not_both()
        payload = {"context": "same value both"}
        go(f"/context/{self.PHONE}", method="POST", json=payload)
        zig(f"/context/{self.PHONE}", method="POST", json=payload)
        gr = go(f"/context/{self.PHONE}")
        zr = zig(f"/context/{self.PHONE}")
        assert gr.status_code == zr.status_code == 200
        assert gr.json().get("context") == zr.json().get("context")

    def test_missing_returns_same_status(self):
        skip_if_not_both()
        gr = go("/context/+70000000001")
        zr = zig("/context/+70000000001")
        assert gr.status_code == zr.status_code

    def test_delete_then_get_same(self):
        skip_if_not_both()
        go(f"/context/{self.PHONE}", method="POST", json={"context": "x"})
        zig(f"/context/{self.PHONE}", method="POST", json={"context": "x"})
        go(f"/context/{self.PHONE}", method="DELETE")
        zig(f"/context/{self.PHONE}", method="DELETE")
        gr = go(f"/context/{self.PHONE}")
        zr = zig(f"/context/{self.PHONE}")
        assert gr.status_code == zr.status_code == 404


class TestCompareErrors:
    def test_bad_json_same_status(self):
        skip_if_not_both()
        h = {"content-type": "application/json"}
        gr = go("/signal/openai", method="POST", data="{{bad", headers=h)
        zr = zig("/signal/openai", method="POST", data="{{bad", headers=h)
        assert gr.status_code == zr.status_code == 400

    def test_unknown_route_same_404(self):
        skip_if_not_both()
        gr = go("/this-route-does-not-exist")
        zr = zig("/this-route-does-not-exist")
        assert gr.status_code == zr.status_code == 404

    def test_transcript_empty_same_shape(self):
        skip_if_not_both()
        gr = go("/transcript/no-such-session")
        zr = zig("/transcript/no-such-session")
        if gr.status_code == 503 or zr.status_code == 503:
            pytest.skip("store not configured on one or both")
        assert gr.status_code == zr.status_code
        gd = gr.json()
        zd = zr.json()
        assert list(gd.keys()) == list(zd.keys()) or (
            set(gd.keys()) == set(zd.keys())
        ), f"Different keys: go={list(gd.keys())} zig={list(zd.keys())}"
        assert gd["transcript"] == zd["transcript"] == []

    def test_sessions_list_same_shape(self):
        skip_if_not_both()
        gr = go("/sessions")
        zr = zig("/sessions")
        if gr.status_code == 503 or zr.status_code == 503:
            pytest.skip("store not configured")
        assert gr.status_code == zr.status_code == 200
        gd = gr.json()
        zd = zr.json()
        assert "sessions" in gd
        assert "sessions" in zd
        assert isinstance(gd["sessions"], list)
        assert isinstance(zd["sessions"], list)
