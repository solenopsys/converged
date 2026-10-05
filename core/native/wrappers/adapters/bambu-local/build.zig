const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.option(std.builtin.OptimizeMode, "optimize", "Prioritize performance, safety, or binary size") orelse .fast;
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

    const version_info = b.addWriteFiles();
    _ = version_info.add("VersionInfo.h", "#define BUILD_TIMESTAMP \"zig-build\"\n#define CLIENT_VERSION \"1.3.16\"\n#define PAHO_MQTT_C_VERSION \"1.3.16\"\n#define PAHO_MQTT_C_VERSION_MAJOR 1\n#define PAHO_MQTT_C_VERSION_MINOR 3\n#define PAHO_MQTT_C_VERSION_PATCH 16\n");
    const c_headers = b.addTranslateC(.{
        .root_source_file = b.path("src/c_imports.h"),
        .target = target,
        .optimize = optimize,
    });
    c_headers.addIncludePath(b.path("vendor/paho.mqtt.c/src"));
    lib.root_module.addImport("c", c_headers.createModule());
    lib.root_module.link_libc = true;
    lib.root_module.addIncludePath(version_info.getDirectory());
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
    const test_c_headers = b.addTranslateC(.{
        .root_source_file = b.path("src/c_imports.h"),
        .target = target,
        .optimize = optimize,
    });
    test_c_headers.addIncludePath(b.path("vendor/paho.mqtt.c/src"));
    tests.root_module.addImport("c", test_c_headers.createModule());
    tests.root_module.link_libc = true;
    tests.root_module.addIncludePath(version_info.getDirectory());
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
