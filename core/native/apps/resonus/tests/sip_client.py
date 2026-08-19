"""
Minimal SIP/RTP test client.
Sends INVITE, waits for 200 OK, sends ACK + dummy RTP, then BYE.
"""
import socket
import struct
import time
import random
import threading


def _rtp_packet(seq: int, timestamp: int, ssrc: int, payload: bytes) -> bytes:
    header = struct.pack("!BBHII", 0x80, 96, seq, timestamp, ssrc)
    return header + payload


OPUS_SILENCE = bytes([0xF8, 0xFF, 0xFE])  # minimal silence frame


class SipClient:
    def __init__(self, local_ip: str = "127.0.0.1", local_port: int = 15060):
        self.local_ip = local_ip
        self.local_port = local_port
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.bind((local_ip, local_port))
        self.sock.settimeout(5.0)
        self.call_id = f"{random.randint(100000, 999999)}@{local_ip}"
        self.tag = f"{random.randint(10000, 99999)}"
        self.cseq = 1
        self._rtp_port = local_port + 1
        self._rtp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._rtp_sock.bind((local_ip, self._rtp_port))
        self._rtp_sock.settimeout(1.0)

    def close(self):
        self.sock.close()
        self._rtp_sock.close()

    def invite(self, server_ip: str, server_port: int, to_uri: str = "sip:test@gateway") -> dict:
        """Send INVITE and return parsed 200 OK response."""
        sdp = self._build_sdp()
        msg = (
            f"INVITE {to_uri} SIP/2.0\r\n"
            f"Via: SIP/2.0/UDP {self.local_ip}:{self.local_port};branch=z9hG4bK{random.randint(10000,99999)}\r\n"
            f"From: <sip:test@{self.local_ip}>;tag={self.tag}\r\n"
            f"To: <{to_uri}>\r\n"
            f"Call-ID: {self.call_id}\r\n"
            f"CSeq: {self.cseq} INVITE\r\n"
            f"Contact: <sip:test@{self.local_ip}:{self.local_port}>\r\n"
            f"Content-Type: application/sdp\r\n"
            f"Content-Length: {len(sdp.encode())}\r\n"
            f"\r\n"
            f"{sdp}"
        )
        self.sock.sendto(msg.encode(), (server_ip, server_port))
        return self._wait_for_200()

    def ack(self, server_ip: str, server_port: int, to_uri: str = "sip:test@gateway"):
        msg = (
            f"ACK {to_uri} SIP/2.0\r\n"
            f"Via: SIP/2.0/UDP {self.local_ip}:{self.local_port};branch=z9hG4bK{random.randint(10000,99999)}\r\n"
            f"From: <sip:test@{self.local_ip}>;tag={self.tag}\r\n"
            f"To: <{to_uri}>\r\n"
            f"Call-ID: {self.call_id}\r\n"
            f"CSeq: {self.cseq} ACK\r\n"
            f"Content-Length: 0\r\n"
            f"\r\n"
        )
        self.sock.sendto(msg.encode(), (server_ip, server_port))

    def bye(self, server_ip: str, server_port: int, to_uri: str = "sip:test@gateway"):
        self.cseq += 1
        msg = (
            f"BYE {to_uri} SIP/2.0\r\n"
            f"Via: SIP/2.0/UDP {self.local_ip}:{self.local_port};branch=z9hG4bK{random.randint(10000,99999)}\r\n"
            f"From: <sip:test@{self.local_ip}>;tag={self.tag}\r\n"
            f"To: <{to_uri}>\r\n"
            f"Call-ID: {self.call_id}\r\n"
            f"CSeq: {self.cseq} BYE\r\n"
            f"Content-Length: 0\r\n"
            f"\r\n"
        )
        self.sock.sendto(msg.encode(), (server_ip, server_port))
        # Try to receive 200 OK for BYE
        try:
            data, _ = self.sock.recvfrom(4096)
            return self._parse_response(data.decode(errors="replace"))
        except socket.timeout:
            return {}

    def send_rtp_burst(self, rtp_ip: str, rtp_port: int, count: int = 10):
        """Send N dummy Opus RTP packets."""
        seq = random.randint(0, 65535)
        ts = random.randint(0, 0xFFFFFF)
        ssrc = random.randint(0, 0xFFFFFFFF)
        for _ in range(count):
            pkt = _rtp_packet(seq & 0xFFFF, ts & 0xFFFFFFFF, ssrc, OPUS_SILENCE)
            self._rtp_sock.sendto(pkt, (rtp_ip, rtp_port))
            seq += 1
            ts += 960
            time.sleep(0.02)

    def _wait_for_200(self) -> dict:
        deadline = time.time() + 5.0
        while time.time() < deadline:
            try:
                data, _ = self.sock.recvfrom(8192)
                resp = self._parse_response(data.decode(errors="replace"))
                if resp.get("status_code") == 200:
                    return resp
                if resp.get("status_code", 0) >= 400:
                    return resp
            except socket.timeout:
                break
        return {}

    def _parse_response(self, raw: str) -> dict:
        lines = raw.split("\r\n")
        if not lines:
            return {}
        first = lines[0]
        parts = first.split(" ", 2)
        status = int(parts[1]) if len(parts) >= 2 and parts[1].isdigit() else 0
        headers = {}
        body_lines = []
        in_body = False
        for line in lines[1:]:
            if in_body:
                body_lines.append(line)
            elif line == "":
                in_body = True
            elif ":" in line:
                k, v = line.split(":", 1)
                headers[k.strip().lower()] = v.strip()
        return {
            "status_code": status,
            "status_line": first,
            "headers": headers,
            "body": "\r\n".join(body_lines),
        }

    def _build_sdp(self) -> str:
        ts = int(time.time())
        return (
            f"v=0\r\n"
            f"o=test {ts} {ts} IN IP4 {self.local_ip}\r\n"
            f"s=-\r\n"
            f"c=IN IP4 {self.local_ip}\r\n"
            f"t=0 0\r\n"
            f"m=audio {self._rtp_port} RTP/AVP 96\r\n"
            f"a=rtpmap:96 opus/48000/2\r\n"
            f"a=sendrecv\r\n"
        )

    def parse_sdp_port(self, sdp: str) -> int:
        """Extract audio RTP port from SDP body."""
        for line in sdp.split("\r\n"):
            if line.startswith("m=audio "):
                parts = line.split()
                if len(parts) >= 2:
                    try:
                        return int(parts[1])
                    except ValueError:
                        pass
        return 0
