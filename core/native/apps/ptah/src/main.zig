//! ptah — the platform controller.
//!
//!   ptah run                 reconcile continuously against the cluster
//!   ptah apply [--dry-run]   run exactly one pass and exit
//!   ptah render <input.json> evaluate the policy with no cluster at all
//!
//! `render` is the reason the policy is a pure function: the same code that
//! drives production answers "what would this produce" from a file, in CI,
//! with no apiserver in the picture.

const std = @import("std");
const config_mod = @import("config.zig");
const kube = @import("kube.zig");
const lease = @import("lease.zig");
const policy = @import("policy.zig");
const Reconciler = @import("reconciler.zig").Reconciler;

var g_running = std.atomic.Value(bool).init(true);

fn onSignal(_: std.posix.SIG) callconv(.c) void {
    g_running.store(false, .release);
}

fn installSignalHandlers() void {
    // A rolling update sends SIGTERM; stopping between passes rather than
    // mid-apply is what makes the hand-off clean.
    const action = std.posix.Sigaction{
        .handler = .{ .handler = onSignal },
        .mask = std.posix.sigemptyset(),
        .flags = 0,
    };
    std.posix.sigaction(std.posix.SIG.TERM, &action, null);
    std.posix.sigaction(std.posix.SIG.INT, &action, null);
}

const usage =
    \\ptah — Kubernetes platform controller
    \\
    \\Usage:
    \\  ptah run                  Reconcile continuously (leader-elected)
    \\  ptah apply [--dry-run]    Run one reconcile pass and exit
    \\  ptah render <input.json>  Evaluate the policy offline, print desired state
    \\
    \\Settings (no defaults; missing ones are fatal):
    \\  PTAH_RESYNC_MS            Milliseconds between passes
    \\  PTAH_LEADER_ELECTION      on | off
    \\  PTAH_IDENTITY             Lease holder id (the pod name in-cluster)
    \\  PTAH_KUBE_SERVER          Apiserver URL when running outside a cluster
    \\  PTAH_KUBE_TOKEN           Bearer token for PTAH_KUBE_SERVER (optional)
    \\  PTAH_NAMESPACE            Namespace for the Lease when out of cluster
    \\
;

/// Offline evaluation: read a ReconcileInput, print the desired objects.
fn render(gpa: std.mem.Allocator, io: std.Io, path: []const u8) !u8 {
    const input = try std.Io.Dir.cwd().readFileAlloc(io, path, gpa, .limited(8 * 1024 * 1024));
    defer gpa.free(input);

    var policy_error: ?[]const u8 = null;
    var output = policy.run(gpa, input, &policy_error) catch |err| {
        defer if (policy_error) |message| gpa.free(message);
        std.debug.print("policy failed ({s}): {s}\n", .{ @errorName(err), policy_error orelse "" });
        return 1;
    };
    defer output.deinit();

    var out = std.Io.Writer.Allocating.init(gpa);
    defer out.deinit();
    try out.writer.writeAll("[");
    for (output.resources, 0..) |resource, i| {
        if (i > 0) try out.writer.writeAll(",\n");
        try std.json.Stringify.value(resource, .{ .whitespace = .indent_2 }, &out.writer);
    }
    try out.writer.writeAll("]\n");

    var stdout_buf: [4096]u8 = undefined;
    var stdout = std.Io.File.stdout().writer(io, &stdout_buf);
    try stdout.interface.writeAll(out.written());
    try stdout.interface.flush();
    return 0;
}

fn runController(
    gpa: std.mem.Allocator,
    io: std.Io,
    environ: *config_mod.Environ,
    once: bool,
    dry_run: bool,
) !u8 {
    var config = try config_mod.load(gpa, io, environ);
    defer config.deinit(gpa);

    var client = try kube.Client.init(gpa, io, &config);
    defer client.deinit();

    var reconciler = Reconciler{
        .gpa = gpa,
        .client = &client,
        .config = &config,
        .dry_run = dry_run,
    };

    if (once) {
        const stats = try reconciler.pass();
        std.log.info(
            "pass: applied={d} pruned={d} failed={d}",
            .{ stats.applied, stats.pruned, stats.failed },
        );
        return if (stats.failed == 0) 0 else 1;
    }

    installSignalHandlers();
    std.log.info(
        "ptah starting: server={s} namespace={s} identity={s} resync={d}ms election={s}",
        .{
            config.server,
            config.namespace,
            config.identity,
            config.resync_ms,
            if (config.leader_election) "on" else "off",
        },
    );
    try reconciler.loop(&g_running);
    if (config.leader_election) lease.release(gpa, &client, config.namespace);
    std.log.info("ptah stopped", .{});
    return 0;
}

pub fn main(init: std.process.Init) !u8 {
    const gpa = init.gpa;

    var args = try std.process.Args.Iterator.initAllocator(init.minimal.args, gpa);
    defer args.deinit();
    _ = args.next(); // argv[0]

    const command = args.next() orelse {
        std.debug.print("{s}", .{usage});
        return 1;
    };

    if (std.mem.eql(u8, command, "run")) {
        return runController(gpa, init.io, init.environ_map, false, false);
    }
    if (std.mem.eql(u8, command, "apply")) {
        const flag = args.next();
        const dry_run = flag != null and std.mem.eql(u8, flag.?, "--dry-run");
        return runController(gpa, init.io, init.environ_map, true, dry_run);
    }
    if (std.mem.eql(u8, command, "render")) {
        const path = args.next() orelse {
            std.debug.print("render needs an input file\n{s}", .{usage});
            return 1;
        };
        return render(gpa, init.io, path);
    }

    std.debug.print("unknown command: {s}\n{s}", .{ command, usage });
    return 1;
}
