const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    const openssl_inc = b.path("vendor/openssl-devel/usr/include");
    const openssl_lib = b.path("vendor/openssl-devel/usr/lib64");

    const lib = b.addLibrary(.{
        .name = "bambu_local_adapter",
        .linkage = .dynamic,
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    lib.root_module.link_libc = true;
    lib.root_module.addIncludePath(openssl_inc);
    lib.root_module.addIncludePath(b.path("vendor/paho.mqtt.c/src"));
    lib.root_module.addLibraryPath(openssl_lib);
    lib.root_module.linkSystemLibrary("ssl", .{});
    lib.root_module.linkSystemLibrary("crypto", .{});
    lib.root_module.linkSystemLibrary("pthread", .{});
    lib.root_module.linkSystemLibrary("dl", .{});
    lib.root_module.linkSystemLibrary("rt", .{});
    lib.root_module.addCSourceFiles(.{
        .root = b.path("vendor/paho.mqtt.c/src"),
        .files = &.{
            "MQTTTime.c",
            "MQTTProtocolClient.c",
            "Clients.c",
            "utf-8.c",
            "MQTTPacket.c",
            "MQTTPacketOut.c",
            "Messages.c",
            "Tree.c",
            "Socket.c",
            "Log.c",
            "MQTTPersistence.c",
            "Thread.c",
            "MQTTProtocolOut.c",
            "MQTTPersistenceDefault.c",
            "SocketBuffer.c",
            "LinkedList.c",
            "MQTTProperties.c",
            "MQTTReasonCodes.c",
            "Base64.c",
            "SHA1.c",
            "WebSocket.c",
            "Proxy.c",
            "StackTrace.c",
            "Heap.c",
            "MQTTClient.c",
            "SSLSocket.c",
        },
        .flags = &.{
            "-D_GNU_SOURCE",
            "-DOPENSSL=1",
            "-DPAHO_MQTT_STATIC=1",
        },
    });

    b.installArtifact(lib);
    b.installFile("include/bambu_local_adapter.h", "include/bambu_local_adapter.h");

    const tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    tests.root_module.link_libc = true;
    tests.use_new_linker = false;
    tests.root_module.addIncludePath(openssl_inc);
    tests.root_module.addIncludePath(b.path("vendor/paho.mqtt.c/src"));
    tests.root_module.addLibraryPath(openssl_lib);
    tests.root_module.linkSystemLibrary("ssl", .{});
    tests.root_module.linkSystemLibrary("crypto", .{});
    tests.root_module.linkSystemLibrary("pthread", .{});
    tests.root_module.linkSystemLibrary("dl", .{});
    tests.root_module.linkSystemLibrary("rt", .{});
    tests.root_module.addCSourceFiles(.{
        .root = b.path("vendor/paho.mqtt.c/src"),
        .files = &.{
            "MQTTTime.c",
            "MQTTProtocolClient.c",
            "Clients.c",
            "utf-8.c",
            "MQTTPacket.c",
            "MQTTPacketOut.c",
            "Messages.c",
            "Tree.c",
            "Socket.c",
            "Log.c",
            "MQTTPersistence.c",
            "Thread.c",
            "MQTTProtocolOut.c",
            "MQTTPersistenceDefault.c",
            "SocketBuffer.c",
            "LinkedList.c",
            "MQTTProperties.c",
            "MQTTReasonCodes.c",
            "Base64.c",
            "SHA1.c",
            "WebSocket.c",
            "Proxy.c",
            "StackTrace.c",
            "Heap.c",
            "MQTTClient.c",
            "SSLSocket.c",
        },
        .flags = &.{
            "-D_GNU_SOURCE",
            "-DOPENSSL=1",
            "-DPAHO_MQTT_STATIC=1",
        },
    });

    const run_tests = b.addRunArtifact(tests);
    const test_step = b.step("test", "Run bambu local adapter tests");
    test_step.dependOn(&run_tests.step);
}
