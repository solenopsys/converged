//! HTTPS to the apiserver, over mbedTLS.
//!
//! `std.http.Client` cannot be used for this. Zig's TLS client has no branch
//! for the TLS 1.3 CertificateRequest message — `certificate_request` exists as
//! an enum value in `std.crypto.tls` and is never handled in the handshake
//! state machine. A Kubernetes apiserver sends one whenever client-certificate
//! authentication is configured, which is the default, so every handshake ends
//! in `error.TlsUnexpectedMessage` before any certificate is examined. No CA or
//! hostname setting works around that.
//!
//! mbedTLS handles it: with no client certificate configured it answers the
//! request with an empty Certificate message, which is what the specification
//! says a client without one should do.
//!
//! What is implemented here is only what talking to an apiserver needs: one
//! request per connection, an explicit CA bundle, `Content-Length` and chunked
//! response bodies. No connection reuse, no redirects, no compression — the
//! apiserver is one host on a LAN and a reconcile pass is a handful of calls.

const std = @import("std");

const c = @cImport({
    @cInclude("mbedtls/ssl.h");
    @cInclude("mbedtls/net_sockets.h");
    @cInclude("psa/crypto.h");
    @cInclude("mbedtls/x509_crt.h");
    @cInclude("mbedtls/error.h");
});

pub const Error = error{
    TlsInit,
    TlsConnect,
    TlsHandshake,
    TlsWrite,
    TlsRead,
    CaLoadFailed,
    BadUrl,
    BadResponse,
    ResponseTooLarge,
};

/// Ceiling on a single response body. A list of every ConfigMap in a busy
/// namespace is the largest thing ptah reads, and a bound is what keeps a
/// runaway apiserver from turning into an allocation failure somewhere less
/// obvious.
pub const max_response_bytes = 64 * 1024 * 1024;

/// Long-lived TLS material: the CA bundle and the RNG. Parsing the bundle on
/// every request would be pure waste, and seeding the DRBG repeatedly more so.
pub const Context = struct {
    ca: c.mbedtls_x509_crt,
    conf: c.mbedtls_ssl_config,
    /// False when no CA was supplied, which only happens for plain HTTP.
    verify: bool,

    pub fn init(self: *Context, ca_path: ?[]const u8) Error!void {
        c.mbedtls_x509_crt_init(&self.ca);
        c.mbedtls_ssl_config_init(&self.conf);
        self.verify = false;

        // This build is mbedTLS 4.x, where randomness comes from PSA rather
        // than a caller-supplied DRBG: there is no `mbedtls_ssl_conf_rng` to
        // call, and the TLS stack refuses to run until PSA is initialised.
        if (c.psa_crypto_init() != c.PSA_SUCCESS) return Error.TlsInit;

        if (c.mbedtls_ssl_config_defaults(
            &self.conf,
            c.MBEDTLS_SSL_IS_CLIENT,
            c.MBEDTLS_SSL_TRANSPORT_STREAM,
            c.MBEDTLS_SSL_PRESET_DEFAULT,
        ) != 0) return Error.TlsInit;

        if (ca_path) |path| {
            var buf: [std.fs.max_path_bytes]u8 = undefined;
            const zpath = std.fmt.bufPrintZ(&buf, "{s}", .{path}) catch return Error.CaLoadFailed;
            // A negative return is a hard failure; a positive one counts certs
            // that failed to parse, and a bundle we could not fully read is not
            // a bundle worth trusting.
            if (c.mbedtls_x509_crt_parse_file(&self.ca, zpath.ptr) != 0) return Error.CaLoadFailed;
            c.mbedtls_ssl_conf_ca_chain(&self.conf, &self.ca, null);
            c.mbedtls_ssl_conf_authmode(&self.conf, c.MBEDTLS_SSL_VERIFY_REQUIRED);
            self.verify = true;
        }
    }

    pub fn deinit(self: *Context) void {
        c.mbedtls_ssl_config_free(&self.conf);
        c.mbedtls_x509_crt_free(&self.ca);
    }
};

/// One connection, used for exactly one request/response exchange.
const Connection = struct {
    net: c.mbedtls_net_context,
    ssl: c.mbedtls_ssl_context,
    tls: bool,

    fn open(
        self: *Connection,
        ctx: *Context,
        host: [:0]const u8,
        port: [:0]const u8,
        tls: bool,
    ) Error!void {
        c.mbedtls_net_init(&self.net);
        c.mbedtls_ssl_init(&self.ssl);
        self.tls = tls;

        if (c.mbedtls_net_connect(
            &self.net,
            host.ptr,
            port.ptr,
            c.MBEDTLS_NET_PROTO_TCP,
        ) != 0) return Error.TlsConnect;

        if (!tls) return;

        if (c.mbedtls_ssl_setup(&self.ssl, &ctx.conf) != 0) return Error.TlsInit;
        // Server Name Indication, and the name certificate verification is
        // done against.
        if (c.mbedtls_ssl_set_hostname(&self.ssl, host.ptr) != 0) return Error.TlsInit;
        c.mbedtls_ssl_set_bio(
            &self.ssl,
            &self.net,
            c.mbedtls_net_send,
            c.mbedtls_net_recv,
            null,
        );

        while (true) {
            const rc = c.mbedtls_ssl_handshake(&self.ssl);
            if (rc == 0) break;
            if (rc == c.MBEDTLS_ERR_SSL_WANT_READ or rc == c.MBEDTLS_ERR_SSL_WANT_WRITE) continue;
            return Error.TlsHandshake;
        }
    }

    fn close(self: *Connection) void {
        if (self.tls) {
            _ = c.mbedtls_ssl_close_notify(&self.ssl);
            c.mbedtls_ssl_free(&self.ssl);
        }
        c.mbedtls_net_free(&self.net);
    }

    fn writeAll(self: *Connection, bytes: []const u8) Error!void {
        var sent: usize = 0;
        while (sent < bytes.len) {
            const rc = if (self.tls)
                c.mbedtls_ssl_write(&self.ssl, bytes.ptr + sent, bytes.len - sent)
            else
                c.mbedtls_net_send(&self.net, bytes.ptr + sent, bytes.len - sent);
            if (rc == c.MBEDTLS_ERR_SSL_WANT_READ or rc == c.MBEDTLS_ERR_SSL_WANT_WRITE) continue;
            if (rc <= 0) return Error.TlsWrite;
            sent += @intCast(rc);
        }
    }

    /// Returns 0 at end of stream. A peer that closes without close_notify is
    /// treated as end of stream too: the response length is taken from the
    /// headers, so a truncated body is caught by the caller, not here.
    fn read(self: *Connection, buf: []u8) Error!usize {
        while (true) {
            const rc = if (self.tls)
                c.mbedtls_ssl_read(&self.ssl, buf.ptr, buf.len)
            else
                c.mbedtls_net_recv(&self.net, buf.ptr, buf.len);
            if (rc == c.MBEDTLS_ERR_SSL_WANT_READ or rc == c.MBEDTLS_ERR_SSL_WANT_WRITE) continue;
            // TLS 1.3 servers send session tickets after the handshake, and
            // mbedTLS surfaces each one as a non-fatal return rather than
            // swallowing it. There is no session cache here, so the only
            // correct response is to read again.
            if (rc == c.MBEDTLS_ERR_SSL_RECEIVED_NEW_SESSION_TICKET) continue;
            if (rc == c.MBEDTLS_ERR_SSL_PEER_CLOSE_NOTIFY) return 0;
            if (rc == c.MBEDTLS_ERR_NET_CONN_RESET) return 0;
            if (rc < 0) return Error.TlsRead;
            return @intCast(rc);
        }
    }
};

pub const Url = struct {
    tls: bool,
    host: []const u8,
    port: []const u8,
    target: []const u8,
};

/// Split `scheme://host[:port]/path`. Only the two schemes ptah uses.
pub fn parseUrl(url: []const u8) Error!Url {
    const tls = if (std.mem.startsWith(u8, url, "https://"))
        true
    else if (std.mem.startsWith(u8, url, "http://"))
        false
    else
        return Error.BadUrl;

    const rest = url[(if (tls) "https://".len else "http://".len)..];
    const slash = std.mem.indexOfScalar(u8, rest, '/') orelse rest.len;
    const authority = rest[0..slash];
    if (authority.len == 0) return Error.BadUrl;

    const colon = std.mem.lastIndexOfScalar(u8, authority, ':');
    return .{
        .tls = tls,
        .host = if (colon) |i| authority[0..i] else authority,
        .port = if (colon) |i| authority[i + 1 ..] else if (tls) "443" else "80",
        .target = if (slash < rest.len) rest[slash..] else "/",
    };
}

pub const Response = struct {
    status: u16,
    body: []u8,

    pub fn deinit(self: *Response, gpa: std.mem.Allocator) void {
        gpa.free(self.body);
        self.* = undefined;
    }
};

pub const Request = struct {
    method: []const u8,
    url: []const u8,
    /// Sent verbatim, one per line, without the trailing CRLF.
    headers: []const []const u8,
    body: ?[]const u8,
};

/// Perform one request. The connection is opened and closed around it.
pub fn fetch(gpa: std.mem.Allocator, ctx: *Context, req: Request) !Response {
    const url = try parseUrl(req.url);

    var host_buf: [256]u8 = undefined;
    var port_buf: [8]u8 = undefined;
    const host = std.fmt.bufPrintZ(&host_buf, "{s}", .{url.host}) catch return Error.BadUrl;
    const port = std.fmt.bufPrintZ(&port_buf, "{s}", .{url.port}) catch return Error.BadUrl;

    var conn: Connection = undefined;
    try conn.open(ctx, host, port, url.tls);
    defer conn.close();

    var head = std.Io.Writer.Allocating.init(gpa);
    defer head.deinit();
    const w = &head.writer;
    try w.print("{s} {s} HTTP/1.1\r\n", .{ req.method, url.target });
    try w.print("host: {s}\r\n", .{url.host});
    // No keep-alive: one exchange per connection means no state to get wrong
    // between them, and a reconcile pass makes few enough calls for the extra
    // handshakes not to matter.
    try w.writeAll("connection: close\r\n");
    for (req.headers) |header| try w.print("{s}\r\n", .{header});
    if (req.body) |body| try w.print("content-length: {d}\r\n", .{body.len});
    try w.writeAll("\r\n");
    try conn.writeAll(head.written());
    if (req.body) |body| try conn.writeAll(body);

    return readResponse(gpa, &conn);
}

fn readResponse(gpa: std.mem.Allocator, conn: *Connection) !Response {
    var raw = std.ArrayList(u8).empty;
    defer raw.deinit(gpa);

    // Headers first. They are small, but the same read loop pulls in the start
    // of the body, so everything is accumulated and split afterwards.
    var chunk: [16 * 1024]u8 = undefined;
    var header_end: ?usize = null;
    while (header_end == null) {
        const n = try conn.read(&chunk);
        if (n == 0) return Error.BadResponse;
        try raw.appendSlice(gpa, chunk[0..n]);
        if (raw.items.len > max_response_bytes) return Error.ResponseTooLarge;
        header_end = std.mem.indexOf(u8, raw.items, "\r\n\r\n");
    }

    const head = raw.items[0..header_end.?];
    var lines = std.mem.splitSequence(u8, head, "\r\n");
    const status_line = lines.next() orelse return Error.BadResponse;
    const status = try parseStatus(status_line);

    var content_length: ?usize = null;
    var chunked = false;
    while (lines.next()) |line| {
        if (headerIs(line, "content-length")) |value| {
            content_length = std.fmt.parseInt(usize, std.mem.trim(u8, value, " \t"), 10) catch
                return Error.BadResponse;
        } else if (headerIs(line, "transfer-encoding")) |value| {
            if (std.mem.indexOf(u8, value, "chunked") != null) chunked = true;
        }
    }

    var body = std.ArrayList(u8).empty;
    errdefer body.deinit(gpa);
    try body.appendSlice(gpa, raw.items[header_end.? + 4 ..]);

    if (chunked) {
        try readChunked(gpa, conn, &body);
    } else if (content_length) |len| {
        while (body.items.len < len) {
            const n = try conn.read(&chunk);
            if (n == 0) break;
            try body.appendSlice(gpa, chunk[0..n]);
            if (body.items.len > max_response_bytes) return Error.ResponseTooLarge;
        }
        if (body.items.len > len) body.shrinkRetainingCapacity(len);
    } else {
        // Neither header: the body runs until the peer closes, which is what
        // `connection: close` asks for.
        while (true) {
            const n = try conn.read(&chunk);
            if (n == 0) break;
            try body.appendSlice(gpa, chunk[0..n]);
            if (body.items.len > max_response_bytes) return Error.ResponseTooLarge;
        }
    }

    return .{ .status = status, .body = try body.toOwnedSlice(gpa) };
}

/// Decode chunked transfer encoding in place: `body` arrives holding the
/// undecoded prefix already read with the headers and leaves holding the
/// decoded payload.
fn readChunked(
    gpa: std.mem.Allocator,
    conn: *Connection,
    body: *std.ArrayList(u8),
) !void {
    var encoded = std.ArrayList(u8).empty;
    defer encoded.deinit(gpa);
    try encoded.appendSlice(gpa, body.items);
    body.clearRetainingCapacity();

    var chunk: [16 * 1024]u8 = undefined;
    var cursor: usize = 0;
    while (true) {
        // Each chunk starts with a hex length terminated by CRLF.
        const line_end = while (true) {
            if (std.mem.indexOfPos(u8, encoded.items, cursor, "\r\n")) |i| break i;
            const n = try conn.read(&chunk);
            if (n == 0) return Error.BadResponse;
            try encoded.appendSlice(gpa, chunk[0..n]);
            if (encoded.items.len > max_response_bytes) return Error.ResponseTooLarge;
        };

        // A chunk extension after ';' is legal and ignored.
        const size_field = encoded.items[cursor..line_end];
        const size_text = if (std.mem.indexOfScalar(u8, size_field, ';')) |i|
            size_field[0..i]
        else
            size_field;
        const size = std.fmt.parseInt(usize, std.mem.trim(u8, size_text, " \t"), 16) catch
            return Error.BadResponse;

        cursor = line_end + 2;
        if (size == 0) return; // Trailers, if any, are not used.

        while (encoded.items.len < cursor + size + 2) {
            const n = try conn.read(&chunk);
            if (n == 0) return Error.BadResponse;
            try encoded.appendSlice(gpa, chunk[0..n]);
            if (encoded.items.len > max_response_bytes) return Error.ResponseTooLarge;
        }
        try body.appendSlice(gpa, encoded.items[cursor .. cursor + size]);
        cursor += size + 2; // Skip the chunk's trailing CRLF.
    }
}

fn parseStatus(line: []const u8) Error!u16 {
    // "HTTP/1.1 200 OK"
    var parts = std.mem.splitScalar(u8, line, ' ');
    _ = parts.next() orelse return Error.BadResponse;
    const code = parts.next() orelse return Error.BadResponse;
    return std.fmt.parseInt(u16, code, 10) catch Error.BadResponse;
}

/// Case-insensitive header match; returns the trimmed value.
fn headerIs(line: []const u8, name: []const u8) ?[]const u8 {
    const colon = std.mem.indexOfScalar(u8, line, ':') orelse return null;
    if (!std.ascii.eqlIgnoreCase(std.mem.trim(u8, line[0..colon], " \t"), name)) return null;
    return std.mem.trim(u8, line[colon + 1 ..], " \t");
}

test "parseUrl splits scheme, authority and target" {
    const https = try parseUrl("https://kubernetes.default.svc:443/api/v1/namespaces");
    try std.testing.expect(https.tls);
    try std.testing.expectEqualStrings("kubernetes.default.svc", https.host);
    try std.testing.expectEqualStrings("443", https.port);
    try std.testing.expectEqualStrings("/api/v1/namespaces", https.target);

    const plain = try parseUrl("http://127.0.0.1:8001/apis");
    try std.testing.expect(!plain.tls);
    try std.testing.expectEqualStrings("127.0.0.1", plain.host);
    try std.testing.expectEqualStrings("8001", plain.port);

    // A missing port takes the scheme's default, and a missing path is "/".
    const bare = try parseUrl("https://example.com");
    try std.testing.expectEqualStrings("443", bare.port);
    try std.testing.expectEqualStrings("/", bare.target);

    try std.testing.expectError(Error.BadUrl, parseUrl("ftp://example.com"));
}

test "header matching ignores case and surrounding space" {
    try std.testing.expectEqualStrings("42", headerIs("Content-Length: 42", "content-length").?);
    try std.testing.expectEqualStrings("chunked", headerIs("transfer-encoding:  chunked ", "transfer-encoding").?);
    try std.testing.expect(headerIs("x-other: 1", "content-length") == null);
}

test "status comes from the first line" {
    try std.testing.expectEqual(@as(u16, 200), try parseStatus("HTTP/1.1 200 OK"));
    try std.testing.expectEqual(@as(u16, 404), try parseStatus("HTTP/1.1 404 Not Found"));
    try std.testing.expectError(Error.BadResponse, parseStatus("garbage"));
}
