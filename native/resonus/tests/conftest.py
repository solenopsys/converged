"""
pytest fixtures for gateway integration tests.

Environment variables (override defaults):
  GO_HTTP_PORT      default 8081
  GO_SIP_PORT       default 5060
  ZIG_HTTP_PORT     default 8090
  ZIG_SIP_PORT      default 5061
  MOCK_OPENAI_PORT  default 19876
  RUN_GO            set to "1" to include Go tests (needs running Go gateway)
  RUN_ZIG           set to "1" to include Zig tests (needs running Zig gateway)
"""
import os
import pytest
import requests
from mock_openai import MockOpenAIServer


def _port(env: str, default: int) -> int:
    return int(os.environ.get(env, default))


MOCK_PORT = _port("MOCK_OPENAI_PORT", 19876)
GO_HTTP = _port("GO_HTTP_PORT", 8081)
GO_SIP = _port("GO_SIP_PORT", 5060)
ZIG_HTTP = _port("ZIG_HTTP_PORT", 8090)
ZIG_SIP = _port("ZIG_SIP_PORT", 5061)

RUN_GO = os.environ.get("RUN_GO", "0") == "1"
RUN_ZIG = os.environ.get("RUN_ZIG", "1") == "1"


class GatewayHandle:
    def __init__(self, name: str, http_port: int, sip_port: int):
        self.name = name
        self.http_port = http_port
        self.sip_port = sip_port
        self.base_url = f"http://127.0.0.1:{http_port}"

    def get(self, path: str, **kw) -> requests.Response:
        return requests.get(f"{self.base_url}{path}", timeout=5, **kw)

    def post(self, path: str, **kw) -> requests.Response:
        return requests.post(f"{self.base_url}{path}", timeout=5, **kw)

    def delete(self, path: str, **kw) -> requests.Response:
        return requests.delete(f"{self.base_url}{path}", timeout=5, **kw)

    def is_up(self) -> bool:
        try:
            r = requests.get(f"{self.base_url}/health", timeout=2)
            return r.status_code == 200
        except Exception:
            return False


@pytest.fixture(scope="session")
def mock_openai():
    srv = MockOpenAIServer(port=MOCK_PORT)
    srv.start()
    yield srv
    srv.stop()


def _gateways():
    result = []
    if RUN_GO:
        result.append(GatewayHandle("go", GO_HTTP, GO_SIP))
    if RUN_ZIG:
        result.append(GatewayHandle("zig", ZIG_HTTP, ZIG_SIP))
    return result


@pytest.fixture(params=_gateways(), ids=lambda g: g.name)
def gateway(request):
    gw: GatewayHandle = request.param
    if not gw.is_up():
        pytest.skip(f"{gw.name} gateway not running on port {gw.http_port}")
    return gw


@pytest.fixture()
def sip(gateway):
    """SIP client bound to a random local port per test."""
    import random
    from sip_client import SipClient
    port = random.randint(25000, 29999)
    client = SipClient(local_port=port)
    yield client, gateway.sip_port
    client.close()
