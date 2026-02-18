const std = @import("std");

const Allocator = std.mem.Allocator;
const c_allocator = std.heap.c_allocator;

const default_host = "127.0.0.1";
const default_probe_path = "/probe";
const default_port: u16 = 5000;
const stop_poll_interval_ns: u64 = 100 * std.time.ns_per_ms;
const ready_poll_interval_ns: u64 = 200 * std.time.ns_per_ms;
const default_stop_timeout_ms: u32 = 3_000;

const Wrapper = struct {
    allocator: Allocator,
    mutex: std.Thread.Mutex = .{},

    pid: ?std.posix.pid_t = null,
    last_exit_status: ?u32 = null,

    host: []u8 = &[_]u8{},
    probe_path: []u8 = &[_]u8{},
    port: u16 = default_port,

    last_error: []u8 = &[_]u8{},

    fn init(allocator: Allocator) Wrapper {
        return .{
            .allocator = allocator,
        };
    }

    fn deinit(self: *Wrapper) void {
        _ = self.stop(default_stop_timeout_ms) catch {};
        self.freeOwnedString(&self.host);
        self.freeOwnedString(&self.probe_path);
        self.freeOwnedString(&self.last_error);
    }

    fn start(
        self: *Wrapper,
        agent_bin: []const u8,
        config_path: []const u8,
        work_dir: ?[]const u8,
        host: ?[]const u8,
        port: u16,
        probe_path: ?[]const u8,
        wait_ready_timeout_ms: u32,
    ) !void {
        if (agent_bin.len == 0 or config_path.len == 0) return error.InvalidArgument;

        self.mutex.lock();
        _ = self.refreshProcessStateLocked();
        if (self.pid != null) {
            self.mutex.unlock();
            return error.AlreadyRunning;
        }

        const pid = try spawnCppAgent(self.allocator, agent_bin, config_path, work_dir);
        self.pid = pid;
        self.last_exit_status = null;

        self.freeOwnedString(&self.host);
        self.host = try self.allocator.dupe(u8, if (host) |h| if (h.len > 0) h else default_host else default_host);

        self.freeOwnedString(&self.probe_path);
        self.probe_path = try self.allocator.dupe(u8, if (probe_path) |p| if (p.len > 0) p else default_probe_path else default_probe_path);

        self.port = if (port == 0) default_port else port;
        try self.setLastErrorLocked("");

        if (wait_ready_timeout_ms == 0) {
            self.mutex.unlock();
            return;
        }
        self.mutex.unlock();

        const ready = self.waitReady(wait_ready_timeout_ms);
        if (!ready) {
            _ = self.stop(default_stop_timeout_ms) catch {};
            self.setLastError("cppagent did not become ready before timeout");
            return error.NotReady;
        }
    }

    fn stop(self: *Wrapper, timeout_ms: u32) !void {
        const effective_timeout: u32 = if (timeout_ms == 0) default_stop_timeout_ms else timeout_ms;
        const deadline = std.time.milliTimestamp() + effective_timeout;

        var target_pid: std.posix.pid_t = undefined;

        self.mutex.lock();
        if (self.pid == null) {
            self.mutex.unlock();
            return;
        }
        target_pid = self.pid.?;
        self.mutex.unlock();

        std.posix.kill(target_pid, std.posix.SIG.TERM) catch |err| switch (err) {
            error.ProcessNotFound => {},
            else => {},
        };

        while (std.time.milliTimestamp() < deadline) {
            self.mutex.lock();
            const running = self.refreshProcessStateLocked();
            self.mutex.unlock();
            if (!running) return;
            std.Thread.sleep(stop_poll_interval_ns);
        }

        std.posix.kill(target_pid, std.posix.SIG.KILL) catch |err| switch (err) {
            error.ProcessNotFound => {},
            else => {},
        };

        while (true) {
            self.mutex.lock();
            const running = self.refreshProcessStateLocked();
            self.mutex.unlock();
            if (!running) break;
            std.Thread.sleep(stop_poll_interval_ns);
        }
    }

    fn isRunning(self: *Wrapper) bool {
        self.mutex.lock();
        defer self.mutex.unlock();
        return self.refreshProcessStateLocked();
    }

    fn getPid(self: *Wrapper) ?std.posix.pid_t {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (!self.refreshProcessStateLocked()) return null;
        return self.pid;
    }

    fn checkHealth(self: *Wrapper) bool {
        const endpoint = self.snapshotEndpoint() catch return false;
        defer endpoint.deinit();
        return isHttpEndpointHealthy(self.allocator, endpoint.host, endpoint.port, endpoint.path) catch false;
    }

    const EndpointSnapshot = struct {
        allocator: Allocator,
        host: []u8,
        path: []u8,
        port: u16,

        fn deinit(self: EndpointSnapshot) void {
            self.allocator.free(self.host);
            self.allocator.free(self.path);
        }
    };

    fn snapshotEndpoint(self: *Wrapper) !EndpointSnapshot {
        self.mutex.lock();
        defer self.mutex.unlock();
        return .{
            .allocator = self.allocator,
            .host = try self.allocator.dupe(u8, if (self.host.len > 0) self.host else default_host),
            .path = try self.allocator.dupe(u8, if (self.probe_path.len > 0) self.probe_path else default_probe_path),
            .port = if (self.port == 0) default_port else self.port,
        };
    }

    fn waitReady(self: *Wrapper, timeout_ms: u32) bool {
        const deadline = std.time.milliTimestamp() + timeout_ms;
        while (std.time.milliTimestamp() < deadline) {
            if (!self.isRunning()) return false;
            if (self.checkHealth()) return true;
            std.Thread.sleep(ready_poll_interval_ns);
        }
        return false;
    }

    fn refreshProcessStateLocked(self: *Wrapper) bool {
        if (self.pid == null) return false;

        const pid = self.pid.?;
        const wait_res = std.posix.waitpid(pid, std.posix.W.NOHANG);
        if (wait_res.pid == 0) return true;

        self.last_exit_status = wait_res.status;
        self.pid = null;
        return false;
    }

    fn setLastError(self: *Wrapper, message: []const u8) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        self.setLastErrorLocked(message) catch {};
    }

    fn setLastErrorLocked(self: *Wrapper, message: []const u8) !void {
        if (self.last_error.len > 0) self.allocator.free(self.last_error);
        self.last_error = if (message.len == 0) &[_]u8{} else try self.allocator.dupe(u8, message);
    }

    fn getLastErrorCopy(self: *Wrapper) ![]u8 {
        self.mutex.lock();
        defer self.mutex.unlock();
        return try c_allocator.dupe(u8, self.last_error);
    }

    fn freeOwnedString(self: *Wrapper, value: *[]u8) void {
        if (value.*.len > 0) self.allocator.free(value.*);
        value.* = &[_]u8{};
    }
};

fn spawnCppAgent(
    allocator: Allocator,
    agent_bin: []const u8,
    config_path: []const u8,
    work_dir: ?[]const u8,
) !std.posix.pid_t {
    var arena_impl = std.heap.ArenaAllocator.init(allocator);
    defer arena_impl.deinit();
    const arena = arena_impl.allocator();

    const agent_bin_z = try arena.dupeZ(u8, agent_bin);
    const config_path_z = try arena.dupeZ(u8, config_path);
    const work_dir_z = if (work_dir) |d| if (d.len > 0) try arena.dupeZ(u8, d) else null else null;

    const argv = try arena.allocSentinel(?[*:0]const u8, 3, null);
    argv[0] = agent_bin_z.ptr;
    argv[1] = "run";
    argv[2] = config_path_z.ptr;

    const fork_result = try std.posix.fork();
    if (fork_result == 0) {
        if (work_dir_z) |wd| {
            std.posix.chdir(wd) catch std.posix.exit(125);
        }

        const envp: [*:null]const ?[*:0]const u8 = @ptrCast(std.c.environ);
        _ = std.posix.execvpeZ(agent_bin_z.ptr, argv.ptr, envp) catch {};
        std.posix.exit(127);
    }

    return fork_result;
}

fn isHttpEndpointHealthy(
    allocator: Allocator,
    host: []const u8,
    port: u16,
    path: []const u8,
) !bool {
    var stream = try std.net.tcpConnectToHost(allocator, host, port);
    defer stream.close();

    const request = try std.fmt.allocPrint(allocator, "GET {s} HTTP/1.1\r\nHost: {s}\r\nConnection: close\r\n\r\n", .{
        path,
        host,
    });
    defer allocator.free(request);

    try stream.writeAll(request);

    var header_buf: [512]u8 = undefined;
    const n = try stream.read(&header_buf);
    if (n == 0) return false;

    const first_line_end = std.mem.indexOfScalar(u8, header_buf[0..n], '\n') orelse return false;
    const line = std.mem.trim(u8, header_buf[0..first_line_end], "\r\n\t ");
    const status = parseHttpStatusLine(line) orelse return false;
    return status >= 200 and status <= 299;
}

fn parseHttpStatusLine(line: []const u8) ?u16 {
    if (!std.mem.startsWith(u8, line, "HTTP/")) return null;

    var parts = std.mem.splitScalar(u8, line, ' ');
    _ = parts.next() orelse return null;
    const code_str = parts.next() orelse return null;
    if (code_str.len != 3) return null;
    return std.fmt.parseInt(u16, code_str, 10) catch null;
}

fn asWrapper(ptr: ?*anyopaque) ?*Wrapper {
    if (ptr == null) return null;
    return @ptrCast(@alignCast(ptr));
}

export fn cppagent_wrapper_create() ?*anyopaque {
    const wrapper = c_allocator.create(Wrapper) catch return null;
    wrapper.* = Wrapper.init(c_allocator);
    return wrapper;
}

export fn cppagent_wrapper_destroy(handle: ?*anyopaque) void {
    const wrapper = asWrapper(handle) orelse return;
    wrapper.deinit();
    c_allocator.destroy(wrapper);
}

export fn cppagent_wrapper_start(
    handle: ?*anyopaque,
    agent_bin: [*:0]const u8,
    config_path: [*:0]const u8,
    work_dir: ?[*:0]const u8,
    host: ?[*:0]const u8,
    port: u16,
    probe_path: ?[*:0]const u8,
    wait_ready_timeout_ms: u32,
) c_int {
    const wrapper = asWrapper(handle) orelse return -1;
    wrapper.start(
        std.mem.sliceTo(agent_bin, 0),
        std.mem.sliceTo(config_path, 0),
        if (work_dir) |p| std.mem.sliceTo(p, 0) else null,
        if (host) |h| std.mem.sliceTo(h, 0) else null,
        port,
        if (probe_path) |p| std.mem.sliceTo(p, 0) else null,
        wait_ready_timeout_ms,
    ) catch |err| {
        wrapper.setLastError(@errorName(err));
        return -2;
    };
    return 0;
}

export fn cppagent_wrapper_stop(handle: ?*anyopaque, timeout_ms: u32) c_int {
    const wrapper = asWrapper(handle) orelse return -1;
    wrapper.stop(timeout_ms) catch |err| {
        wrapper.setLastError(@errorName(err));
        return -2;
    };
    return 0;
}

export fn cppagent_wrapper_is_running(handle: ?*anyopaque) c_int {
    const wrapper = asWrapper(handle) orelse return -1;
    return if (wrapper.isRunning()) 1 else 0;
}

export fn cppagent_wrapper_pid(handle: ?*anyopaque) c_int {
    const wrapper = asWrapper(handle) orelse return -1;
    return if (wrapper.getPid()) |pid| @intCast(pid) else 0;
}

export fn cppagent_wrapper_check_health(handle: ?*anyopaque) c_int {
    const wrapper = asWrapper(handle) orelse return -1;
    return if (wrapper.checkHealth()) 1 else 0;
}

export fn cppagent_wrapper_get_last_error(
    handle: ?*anyopaque,
    out_ptr: *?[*]u8,
    out_len: *usize,
) c_int {
    const wrapper = asWrapper(handle) orelse return -1;
    const copy = wrapper.getLastErrorCopy() catch return -2;
    out_ptr.* = copy.ptr;
    out_len.* = copy.len;
    return 0;
}

export fn cppagent_wrapper_free_buffer(ptr: ?[*]u8, len: usize) void {
    if (ptr) |p| c_allocator.free(p[0..len]);
}

test "parse HTTP status line" {
    try std.testing.expectEqual(@as(?u16, 200), parseHttpStatusLine("HTTP/1.1 200 OK"));
    try std.testing.expectEqual(@as(?u16, 404), parseHttpStatusLine("HTTP/1.0 404 Not Found"));
    try std.testing.expectEqual(@as(?u16, null), parseHttpStatusLine("NOT HTTP"));
}
