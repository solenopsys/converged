@0xa0002f7cd7e4c010;

# Cluster messaging envelope — the header frame of every multipart packet:
#   [envelope][payload]           (peer → router → peer)
# The payload frame is opaque to the router; only this header is parsed
# and rewritten in flight. See final/docs/cluster-messaging.md §5.
#
# The Zig codec (src/envelope.zig) hand-encodes this exact layout and is
# verified against `capnp encode` golden bytes. Any schema change here
# MUST be mirrored in src/envelope.zig and its layout constants.

enum Kind {
  request     @0;
  response    @1;
  error       @2;
  event       @3;   # fire-and-forget, fanned out to WS clients by scope
  streamChunk @4;
  system      @5;   # transport ↔ Fujin only: register / ping / pong
}

enum PayloadCodec {
  json  @0;   # UTF-8 JSON (nrpc serialization)
  capnp @1;   # Cap'n Proto (e.g. behemoth schema/storage/wire.capnp)
  raw   @2;   # arbitrary bytes
}

struct Address {
  target  @0 :Text;   # instance name registered on the router
  service @1 :Text;   # service inside the instance
}

struct Envelope {
  version    @0 :UInt8;
  kind       @1 :Kind;
  requestId  @2 :Text;          # unique per sender; empty only for event/system
  to         @3 :Address;
  from       @4 :Address;       # reply address; router stamps "ws:<connectionId>" for WS clients
  method     @5 :Text;          # nrpc method / control operation
  scope      @6 :Text;          # TRUSTED: stamped by the router for WS packets
  user       @7 :Text;          # trusted session user; empty for intra-cluster
  codec      @8 :PayloadCodec;
  seq        @9 :UInt32;        # stream chunk ordinal (1-based)
  fin        @10 :Bool;         # last stream chunk
  deadlineMs @11 :UInt32;       # caller timeout; 0 is rejected for requests
  errorCode  @12 :Text;         # kind=error: "timeout" | "service_unavailable" | app code
  auth       @13 :Text;         # bearer JWT; trusted only after receiver validation
}
