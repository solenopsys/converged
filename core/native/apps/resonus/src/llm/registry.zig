//! The provider registry: descriptors in, a uniform provider surface out.
//!
//! This is what replaces per-vendor Zig modules. Nothing here knows the name of
//! a vendor; it loads whatever descriptors the `resonus-providers` build emitted
//! and serves them by the name each one declares. Adding a provider is a file in
//! that package plus a rebuild of it — never a change here.
//!
//! Two things are loaded from `dir`:
//!   manifest.json   the provider index, with the hook names each one declares
//!   <name>.table.json   transport + decode table, executed by the core
//!   hooks.js        every provider's warm hooks, evaluated into QuickJS
//!
//! Loading is strict. A descriptor whose declared hook is missing from the
//! bundle, or whose contract version this build does not know, fails startup —
//! the same posture as `LLM_GATE_POLICY_REQUIRED`, and for the same reason: a
//! descriptor that half-loads turns a build mistake into a vendor 400 in
//! production, far from its cause.

const std = @import("std");
const descriptor = @import("descriptor.zig");
const env = @import("../env.zig");
const qjs = @import("../native/qjs_client.zig");

/// pthread primitives, matching the rest of this app: `std.Thread.Mutex` is not
/// available in the Zig version this builds against.
const Mutex = struct {
    raw: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    fn lock(self: *Mutex) void {
        _ = std.c.pthread_mutex_lock(&self.raw);
    }

    fn unlock(self: *Mutex) void {
        _ = std.c.pthread_mutex_unlock(&self.raw);
    }
};

const Condvar = struct {
    raw: std.c.pthread_cond_t = std.c.PTHREAD_COND_INITIALIZER,

    fn wait(self: *Condvar, mutex: *Mutex) void {
        _ = std.c.pthread_cond_wait(&self.raw, &mutex.raw);
    }

    fn signal(self: *Condvar) void {
        _ = std.c.pthread_cond_signal(&self.raw);
    }
};

/// A pool of QuickJS runtimes for warm-hook calls.
///
/// Runtimes are not thread-safe, so a caller leases one for the duration of a
/// call and returns it. Hooks run once per turn or per socket — never per event
/// — so a handful of runtimes behind a mutex is ample; the mutex is never held
/// across anything but the hook itself.
const RuntimePool = struct {
    mutex: Mutex = .{},
    available: Condvar = .{},
    runtimes: []qjs.Runtime,
    free: []bool,

    fn acquire(self: *RuntimePool) *qjs.Runtime {
        self.mutex.lock();
        defer self.mutex.unlock();
        while (true) {
            for (self.free, 0..) |is_free, i| {
                if (!is_free) continue;
                self.free[i] = false;
                return &self.runtimes[i];
            }
            self.available.wait(&self.mutex);
        }
    }

    fn release(self: *RuntimePool, runtime: *qjs.Runtime) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        for (self.runtimes, 0..) |*candidate, i| {
            if (candidate == runtime) {
                self.free[i] = true;
                break;
            }
        }
        self.available.signal();
    }
};

pub const Entry = struct {
    table: descriptor.Descriptor,

    pub fn name(self: *const Entry) []const u8 {
        return self.table.name;
    }
};

pub const Registry = struct {
    gpa: std.mem.Allocator,
    entries: []Entry,
    pool: RuntimePool,

    pub const Options = struct {
        /// Directory holding manifest.json, the tables and hooks.js.
        dir: []const u8,
        /// Path to the QuickJS wrapper .so.
        qjs_lib: []const u8,
        /// Runtimes to keep for hook calls. Hooks are warm-path work, so this
        /// bounds concurrency, not throughput.
        runtimes: usize = 2,
    };

    pub fn init(gpa: std.mem.Allocator, options: Options) !Registry {
        const manifest_path = try std.fs.path.join(gpa, &.{ options.dir, "manifest.json" });
        defer gpa.free(manifest_path);
        const manifest_text = try readFile(gpa, manifest_path);
        defer gpa.free(manifest_text);

        var manifest = try std.json.parseFromSlice(std.json.Value, gpa, manifest_text, .{});
        defer manifest.deinit();

        const providers = arrField(manifest.value, "providers") orelse return error.ManifestInvalid;
        if (providers.len == 0) return error.ManifestEmpty;

        var entries: std.ArrayList(Entry) = .empty;
        errdefer {
            for (entries.items) |*entry| entry.table.deinit();
            entries.deinit(gpa);
        }

        for (providers) |item| {
            const file = strField(item, "table") orelse return error.ManifestInvalid;
            const path = try std.fs.path.join(gpa, &.{ options.dir, file });
            defer gpa.free(path);
            const text = try readFile(gpa, path);
            defer gpa.free(text);
            try entries.append(gpa, .{ .table = try descriptor.parse(gpa, text) });
        }

        // The hook bundle is loaded into every runtime. Compiling it once and
        // sharing bytecode would be faster, but this happens once at startup and
        // the source path keeps the failure message readable.
        const hooks_path = try std.fs.path.join(gpa, &.{ options.dir, "hooks.js" });
        defer gpa.free(hooks_path);
        const hooks_source = try readFile(gpa, hooks_path);
        defer gpa.free(hooks_source);

        const count = @max(options.runtimes, 1);
        const runtimes = try gpa.alloc(qjs.Runtime, count);
        errdefer gpa.free(runtimes);
        const free = try gpa.alloc(bool, count);
        errdefer gpa.free(free);

        var opened: usize = 0;
        errdefer for (runtimes[0..opened]) |*rt| rt.deinit();
        while (opened < count) : (opened += 1) {
            runtimes[opened] = try qjs.Runtime.open(gpa, options.qjs_lib);
            runtimes[opened].setHostFn(hostBridge, null);
            try runtimes[opened].load(hooks_source, "hooks.js");
            free[opened] = true;
        }

        // Every hook a table may call must exist before the first turn, not on
        // the turn that happens to need it.
        for (entries.items) |*entry| {
            for (entry.table.hooks) |hook| {
                var buf: [128]u8 = undefined;
                const symbol = std.fmt.bufPrint(&buf, "{s}__{s}", .{ entry.table.name, hook }) catch
                    return error.HookNameTooLong;
                if (!runtimes[0].hasFn(symbol)) {
                    std.log.err("provider {s}: declared hook '{s}' is missing from hooks.js", .{
                        entry.table.name, hook,
                    });
                    return error.HookMissing;
                }
            }
            std.log.info("provider {s}: {s} transport, {d} hook(s)", .{
                entry.table.name,
                @tagName(entry.table.transport.kind),
                entry.table.hooks.len,
            });
        }

        return .{
            .gpa = gpa,
            .entries = try entries.toOwnedSlice(gpa),
            .pool = .{ .runtimes = runtimes, .free = free },
        };
    }

    pub fn deinit(self: *Registry) void {
        for (self.entries) |*entry| entry.table.deinit();
        self.gpa.free(self.entries);
        for (self.pool.runtimes) |*rt| rt.deinit();
        self.gpa.free(self.pool.runtimes);
        self.gpa.free(self.pool.free);
        self.* = undefined;
    }

    pub fn find(self: *Registry, name: []const u8) ?*Entry {
        for (self.entries) |*entry| {
            if (std.mem.eql(u8, entry.table.name, name)) return entry;
        }
        return null;
    }

    /// Call `<provider>__<hook>(argsJson)`. The reply is caller-owned.
    pub fn callHook(
        self: *Registry,
        a: std.mem.Allocator,
        provider_name: []const u8,
        hook: []const u8,
        args_json: []const u8,
    ) ![]const u8 {
        var buf: [128]u8 = undefined;
        const symbol = std.fmt.bufPrint(&buf, "{s}__{s}", .{ provider_name, hook }) catch
            return error.HookNameTooLong;

        const runtime = self.pool.acquire();
        defer self.pool.release(runtime);

        var result = try runtime.call(symbol, args_json);
        defer result.deinit(runtime.allocator);
        if (result.code != 0) {
            std.log.err("hook {s} failed: {s}", .{ symbol, result.text });
            return error.HookFailed;
        }
        return a.dupe(u8, result.text);
    }
};

/// Resolve `${secret:name}`, `${env:NAME}`, `${env:NAME:default}` and
/// `${model}` in a descriptor string.
///
/// Secrets are substituted here, in Zig, and never handed to the script: a
/// descriptor writes the *shape* of an authorization header, not its value. The
/// sandbox has no network, but `__host` is a channel out of it, and a key that
/// never enters cannot leave.
pub fn substitute(
    a: std.mem.Allocator,
    template: []const u8,
    model: []const u8,
    secrets: *const Secrets,
) ![]const u8 {
    var out: std.ArrayList(u8) = .empty;
    errdefer out.deinit(a);

    var rest = template;
    while (std.mem.indexOf(u8, rest, "${")) |start| {
        try out.appendSlice(a, rest[0..start]);
        const end = std.mem.indexOfScalarPos(u8, rest, start, '}') orelse return error.PlaceholderUnterminated;
        const body = rest[start + 2 .. end];
        rest = rest[end + 1 ..];

        if (std.mem.eql(u8, body, "model")) {
            try out.appendSlice(a, model);
        } else if (std.mem.startsWith(u8, body, "secret:")) {
            const key = body["secret:".len..];
            // No logging here: substitution is a pure function, and the caller
            // knows which provider and field it was resolving.
            try out.appendSlice(a, secrets.get(key) orelse return error.SecretMissing);
        } else if (std.mem.startsWith(u8, body, "env:")) {
            const spec = body["env:".len..];
            // `env:NAME:default` — the default may itself contain colons (it is
            // usually a URL), so only the first one separates.
            const split = std.mem.indexOfScalar(u8, spec, ':');
            const key = if (split) |i| spec[0..i] else spec;
            const fallback = if (split) |i| spec[i + 1 ..] else "";
            var name_buf: [128]u8 = undefined;
            const name = std.fmt.bufPrintZ(&name_buf, "{s}", .{key}) catch return error.PlaceholderUnknown;
            try out.appendSlice(a, env.opt(name) orelse fallback);
        } else {
            return error.PlaceholderUnknown;
        }
    }
    try out.appendSlice(a, rest);
    return out.toOwnedSlice(a);
}

/// Secret values by descriptor key. Populated from the environment at startup so
/// the substitution path has no ambient access of its own.
pub const Secrets = struct {
    names: []const []const u8 = &.{},
    values: []const []const u8 = &.{},

    pub fn get(self: *const Secrets, key: []const u8) ?[]const u8 {
        for (self.names, 0..) |name, i| {
            if (std.mem.eql(u8, name, key)) return self.values[i];
        }
        return null;
    }
};

/// The sandbox's only way out.
///
/// It carries no I/O — just work that would be wasteful or wrong to reimplement
/// in JavaScript. `sha256` is the whole surface today: descriptors need it for a
/// content-derived multipart boundary, and hashing is exactly the fixed, heavy
/// kind of work that belongs on this side.
fn hostBridge(
    _: ?*anyopaque,
    arg: [*]const u8,
    arg_len: usize,
    out_ptr: *?[*]u8,
    out_len: *usize,
) callconv(.c) c_int {
    out_ptr.* = null;
    out_len.* = 0;

    var arena = std.heap.ArenaAllocator.init(std.heap.c_allocator);
    defer arena.deinit();
    const a = arena.allocator();

    const request = std.json.parseFromSliceLeaky(std.json.Value, a, arg[0..arg_len], .{}) catch return -1;
    const op = strField(request, "op") orelse return -1;
    const data = strField(request, "data") orelse return -1;

    if (!std.mem.eql(u8, op, "sha256")) {
        std.log.err("__host: unknown op '{s}'", .{op});
        return -1;
    }

    var digest: [std.crypto.hash.sha2.Sha256.digest_length]u8 = undefined;
    std.crypto.hash.sha2.Sha256.hash(data, &digest, .{});
    const hex = std.fmt.bytesToHex(digest, .lower);

    // The reply must outlive the arena: the wrapper copies it into a JS string
    // and frees it with the C allocator.
    const owned = std.heap.c_allocator.dupe(u8, &hex) catch return -1;
    out_ptr.* = owned.ptr;
    out_len.* = owned.len;
    return 0;
}

fn readFile(gpa: std.mem.Allocator, path: []const u8) ![]u8 {
    return std.Io.Dir.cwd().readFileAlloc(
        std.Options.debug_io,
        path,
        gpa,
        .limited(4 * 1024 * 1024),
    ) catch |err| {
        std.log.err("provider registry: cannot read {s}: {s}", .{ path, @errorName(err) });
        return err;
    };
}

fn strField(v: std.json.Value, key: []const u8) ?[]const u8 {
    if (v != .object) return null;
    const found = v.object.get(key) orelse return null;
    return switch (found) {
        .string => |s| s,
        else => null,
    };
}

fn arrField(v: std.json.Value, key: []const u8) ?[]const std.json.Value {
    if (v != .object) return null;
    const found = v.object.get(key) orelse return null;
    return switch (found) {
        .array => |items| items.items,
        else => null,
    };
}

// ---- tests ------------------------------------------------------------------

const testing = std.testing;

test "substitution resolves model, secrets and env defaults" {
    const a = testing.allocator;
    const secrets = Secrets{
        .names = &.{"openai"},
        .values = &.{"sk-test"},
    };

    const url = try substitute(
        a,
        "${env:NO_SUCH_VAR_HERE:wss://api.openai.com/v1/realtime}?model=${model}",
        "gpt-realtime",
        &secrets,
    );
    defer a.free(url);
    try testing.expectEqualStrings("wss://api.openai.com/v1/realtime?model=gpt-realtime", url);

    const header = try substitute(a, "Bearer ${secret:openai}", "", &secrets);
    defer a.free(header);
    try testing.expectEqualStrings("Bearer sk-test", header);
}

test "a missing secret fails loudly rather than sending an empty header" {
    const secrets = Secrets{};
    try testing.expectError(
        error.SecretMissing,
        substitute(testing.allocator, "Bearer ${secret:openai}", "", &secrets),
    );
}

test "an unterminated or unknown placeholder is refused" {
    const secrets = Secrets{};
    try testing.expectError(
        error.PlaceholderUnterminated,
        substitute(testing.allocator, "${secret:openai", "", &secrets),
    );
    try testing.expectError(
        error.PlaceholderUnknown,
        substitute(testing.allocator, "${wat:x}", "", &secrets),
    );
}

test "a template without placeholders is copied verbatim" {
    const secrets = Secrets{};
    const out = try substitute(testing.allocator, "https://example.com/v1", "", &secrets);
    defer testing.allocator.free(out);
    try testing.expectEqualStrings("https://example.com/v1", out);
}
