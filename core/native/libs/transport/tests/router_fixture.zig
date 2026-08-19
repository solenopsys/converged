const std = @import("std");
const transport = @import("transport");

pub fn main(init: std.process.Init) !void {
    const allocator = init.gpa;
    var args = std.process.Args.Iterator.init(init.minimal.args);
    _ = args.next();
    const endpoint = args.next() orelse return error.EndpointRequired;
    if (args.next() != null) return error.TooManyArguments;
    const limits = transport.Limits{ .max_envelope_bytes = 4096, .max_payload_bytes = 1 << 20 };
    var router = try transport.Router.init(endpoint, limits);
    defer router.deinit();
    try router.setRecvTimeoutMs(5000);
    std.debug.print("ready\n", .{});

    var request = (try router.recv()) orelse return error.TestTimeout;
    defer request.deinit();
    const env = try request.parseEnvelope();
    const response = transport.Envelope{
        .kind = .response,
        .request_id = env.request_id,
        .to = env.from,
        .from = env.to,
        .method = env.method,
        .scope = env.scope,
        .user = env.user,
        .codec = env.codec,
    };
    const encoded = try transport.envelope.encodeAlloc(allocator, &response);
    defer allocator.free(encoded);
    try router.send(request.identity(), encoded, request.payload());
}
