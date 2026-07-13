const std = @import("std");
const Plugin = @import("plugin.zig").Plugin;
const Policy = @import("qjs_policy.zig").Policy;
const TaskAction = @import("qjs_policy.zig").TaskAction;
const IdleAction = @import("qjs_policy.zig").IdleAction;
const Mutex = @import("sync.zig").Mutex;

pub const TaskState = enum {
    queued,
    running,
    completed,
    failed,
    cancelled,
};

pub const TaskSnapshot = struct {
    id: u64,
    state: TaskState,
    result: ?[]const u8,
    error_text: ?[]const u8,
};

const Task = struct {
    id: u64,
    plugin_index: usize,
    request: []u8,
    state: TaskState = .queued,
    result: ?[]u8 = null,
    error_text: ?[]u8 = null,
};

const PluginRecord = struct {
    plugin: Plugin,
    worker: ?std.Thread = null,
    worker_running: bool = false,
    worker_done: bool = false,
    loaded: bool = false,
    last_activity_ms: u64,
};

const TaskForPolicy = struct {
    id: u64,
    plugin_index: usize,
    plugin_name: []u8,
    payload: []u8,

    fn deinit(self: *TaskForPolicy, allocator: std.mem.Allocator) void {
        allocator.free(self.plugin_name);
        allocator.free(self.payload);
    }
};

/// In-process plugin hub. Plugin implementations are compiled Zig modules;
/// only their heavyweight native wrapper libraries are loaded dynamically.
/// `tick` is intentionally explicit for now: a future API/daemon can call it
/// from its own event loop without forcing a networking model onto ptah.
pub const Hub = struct {
    allocator: std.mem.Allocator,
    policy: Policy,
    plugins: []PluginRecord,
    tasks: std.ArrayList(Task) = .empty,
    idle_timeout_ms: u64,
    next_task_id: u64 = 1,
    mutex: Mutex = .{},
    tick_mutex: Mutex = .{},

    pub fn init(
        allocator: std.mem.Allocator,
        policy: Policy,
        plugin_list: []const Plugin,
        idle_timeout_ms: u64,
    ) !Hub {
        const plugins = try allocator.alloc(PluginRecord, plugin_list.len);
        const now = monotonicMs();
        for (plugin_list, 0..) |plugin, index| {
            plugins[index] = .{
                .plugin = plugin,
                .last_activity_ms = now,
            };
        }
        return .{
            .allocator = allocator,
            .policy = policy,
            .plugins = plugins,
            .idle_timeout_ms = idle_timeout_ms,
        };
    }

    pub fn deinit(self: *Hub) void {
        self.tick_mutex.lock();

        // Native calls are not forcibly interrupted. Joining preserves wrapper
        // ownership and prevents dlclose while a C/C++ call is still active.
        for (self.plugins) |*record| {
            if (record.worker) |thread| {
                thread.join();
                record.worker = null;
            }
            if (record.loaded) record.plugin.stop();
        }

        for (self.tasks.items) |*task| {
            self.allocator.free(task.request);
            if (task.result) |result| self.allocator.free(result);
            if (task.error_text) |text| self.allocator.free(text);
        }
        self.tasks.deinit(self.allocator);
        self.allocator.free(self.plugins);
        self.policy.deinit();
        self.tick_mutex.unlock();
        self.* = undefined;
    }

    pub fn submit(self: *Hub, plugin_name: []const u8, request_json: []const u8) !u64 {
        self.mutex.lock();
        defer self.mutex.unlock();
        const plugin_index = self.findPluginLocked(plugin_name) orelse return error.PluginNotFound;
        const id = self.next_task_id;
        self.next_task_id += 1;
        try self.tasks.append(self.allocator, .{
            .id = id,
            .plugin_index = plugin_index,
            .request = try self.allocator.dupe(u8, request_json),
        });
        return id;
    }

    pub fn getTask(self: *Hub, id: u64) ?TaskSnapshot {
        self.mutex.lock();
        defer self.mutex.unlock();
        const index = self.findTaskLocked(id) orelse return null;
        const item = self.tasks.items[index];
        return .{
            .id = item.id,
            .state = item.state,
            .result = item.result,
            .error_text = item.error_text,
        };
    }

    /// Reap completed workers, give JavaScript a scheduling decision for every
    /// free plugin, then unload idle wrappers when the policy approves it.
    pub fn tick(self: *Hub) !void {
        self.tick_mutex.lock();
        defer self.tick_mutex.unlock();
        self.reapCompletedWorkers();

        for (self.plugins, 0..) |_, plugin_index| {
            try self.dispatchOne(plugin_index);
        }
        try self.unloadIdlePlugins();
    }

    fn dispatchOne(self: *Hub, plugin_index: usize) !void {
        const pending = self.nextQueuedTask(plugin_index) orelse return;
        var task_for_policy = pending;
        defer task_for_policy.deinit(self.allocator);

        const action = self.policy.decideTask(
            task_for_policy.id,
            task_for_policy.plugin_name,
            task_for_policy.payload,
        ) catch |err| {
            self.failQueuedTask(task_for_policy.id, @errorName(err));
            return;
        };

        switch (action) {
            .@"defer" => return,
            .cancel => self.cancelQueuedTask(task_for_policy.id),
            .start => try self.launchWorker(plugin_index, task_for_policy.id),
        }
    }

    fn nextQueuedTask(self: *Hub, plugin_index: usize) ?TaskForPolicy {
        self.mutex.lock();
        defer self.mutex.unlock();
        const record = &self.plugins[plugin_index];
        if (record.worker_running) return null;
        for (self.tasks.items) |item| {
            if (item.plugin_index != plugin_index or item.state != .queued) continue;
            const plugin_name = self.allocator.dupe(u8, record.plugin.name) catch return null;
            const payload = self.allocator.dupe(u8, item.request) catch {
                self.allocator.free(plugin_name);
                return null;
            };
            return .{
                .id = item.id,
                .plugin_index = plugin_index,
                .plugin_name = plugin_name,
                .payload = payload,
            };
        }
        return null;
    }

    fn launchWorker(self: *Hub, plugin_index: usize, task_id: u64) !void {
        self.mutex.lock();
        defer self.mutex.unlock();
        const record = &self.plugins[plugin_index];
        if (record.worker_running) return;
        const task_index = self.findTaskLocked(task_id) orelse return error.TaskNotFound;
        if (self.tasks.items[task_index].state != .queued) return;

        self.tasks.items[task_index].state = .running;
        record.worker_running = true;
        record.worker_done = false;
        record.last_activity_ms = monotonicMs();
        record.worker = std.Thread.spawn(.{}, workerMain, .{ self, plugin_index, task_id }) catch |err| {
            record.worker_running = false;
            self.tasks.items[task_index].state = .queued;
            return err;
        };
    }

    fn workerMain(self: *Hub, plugin_index: usize, task_id: u64) void {
        const plugin = self.plugins[plugin_index].plugin;
        const request = self.copyTaskRequest(task_id) catch |err| {
            self.completeFailure(plugin_index, task_id, @errorName(err));
            return;
        };
        defer self.allocator.free(request);

        plugin.start() catch |err| {
            self.completeFailure(plugin_index, task_id, @errorName(err));
            return;
        };
        self.mutex.lock();
        self.plugins[plugin_index].loaded = true;
        self.mutex.unlock();

        const result = plugin.execute(self.allocator, request) catch |err| {
            self.completeFailure(plugin_index, task_id, @errorName(err));
            return;
        };
        self.completeSuccess(plugin_index, task_id, result);
    }

    fn copyTaskRequest(self: *Hub, task_id: u64) ![]u8 {
        self.mutex.lock();
        defer self.mutex.unlock();
        const index = self.findTaskLocked(task_id) orelse return error.TaskNotFound;
        return self.allocator.dupe(u8, self.tasks.items[index].request);
    }

    fn completeSuccess(self: *Hub, plugin_index: usize, task_id: u64, result: []u8) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        const task_index = self.findTaskLocked(task_id) orelse {
            self.allocator.free(result);
            return;
        };
        const task = &self.tasks.items[task_index];
        task.result = result;
        task.state = .completed;
        self.markWorkerDoneLocked(plugin_index);
    }

    fn completeFailure(self: *Hub, plugin_index: usize, task_id: u64, message: []const u8) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.findTaskLocked(task_id)) |task_index| {
            const task = &self.tasks.items[task_index];
            task.error_text = self.allocator.dupe(u8, message) catch null;
            task.state = .failed;
        }
        self.markWorkerDoneLocked(plugin_index);
    }

    fn markWorkerDoneLocked(self: *Hub, plugin_index: usize) void {
        const record = &self.plugins[plugin_index];
        record.worker_running = false;
        record.worker_done = true;
        record.last_activity_ms = monotonicMs();
    }

    fn reapCompletedWorkers(self: *Hub) void {
        const completed = self.allocator.alloc(std.Thread, self.plugins.len) catch return;
        defer self.allocator.free(completed);
        var count: usize = 0;

        self.mutex.lock();
        for (self.plugins) |*record| {
            if (!record.worker_done) continue;
            if (record.worker) |thread| {
                completed[count] = thread;
                count += 1;
            }
            record.worker = null;
            record.worker_done = false;
        }
        self.mutex.unlock();

        for (completed[0..count]) |thread| thread.join();
    }

    fn unloadIdlePlugins(self: *Hub) !void {
        const now = monotonicMs();
        for (self.plugins, 0..) |*record, index| {
            const should_consider = blk: {
                self.mutex.lock();
                defer self.mutex.unlock();
                if (!record.loaded or record.worker_running or self.hasQueuedTaskLocked(index)) break :blk false;
                break :blk now - record.last_activity_ms >= self.idle_timeout_ms;
            };
            if (!should_consider) continue;

            const action = try self.policy.decideIdle(record.plugin.name, now - record.last_activity_ms);
            if (action != .unload) continue;
            record.plugin.stop();
            self.mutex.lock();
            record.loaded = false;
            record.last_activity_ms = now;
            self.mutex.unlock();
        }
    }

    fn failQueuedTask(self: *Hub, id: u64, message: []const u8) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.findTaskLocked(id)) |index| {
            const task = &self.tasks.items[index];
            if (task.state == .queued) {
                task.error_text = self.allocator.dupe(u8, message) catch null;
                task.state = .failed;
            }
        }
    }

    fn cancelQueuedTask(self: *Hub, id: u64) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.findTaskLocked(id)) |index| {
            if (self.tasks.items[index].state == .queued) self.tasks.items[index].state = .cancelled;
        }
    }

    fn findPluginLocked(self: *Hub, name: []const u8) ?usize {
        for (self.plugins, 0..) |record, index| {
            if (std.mem.eql(u8, record.plugin.name, name)) return index;
        }
        return null;
    }

    fn findTaskLocked(self: *Hub, id: u64) ?usize {
        for (self.tasks.items, 0..) |task, index| {
            if (task.id == id) return index;
        }
        return null;
    }

    fn hasQueuedTaskLocked(self: *Hub, plugin_index: usize) bool {
        for (self.tasks.items) |task| {
            if (task.plugin_index == plugin_index and task.state == .queued) return true;
        }
        return false;
    }
};

fn monotonicMs() u64 {
    var ts: std.c.timespec = undefined;
    _ = std.c.clock_gettime(.MONOTONIC, &ts);
    const seconds: u64 = @intCast(ts.sec);
    const nanos: u64 = @intCast(ts.nsec);
    return seconds * std.time.ms_per_s + nanos / std.time.ns_per_ms;
}
