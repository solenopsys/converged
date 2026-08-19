const std = @import("std");

/// Storage failures travel in the `error :Text` field of the capnp response,
/// which carries no separate code. A caller that has to react to a specific
/// failure — a microservice whose volume is not mounted, for example — needs
/// more than a human sentence, so the text is written as `CODE: detail` and
/// this catalogue is the shared vocabulary of those codes.
pub const Code = enum {
    /// The microservice has no data root in the mount configuration.
    data_dir_not_configured,
    /// The configured data root is not attached (PVC missing or unreadable).
    data_dir_not_mounted,
    /// The mount configuration itself could not be read.
    storage_config_invalid,
    /// A microservice or store name that would escape its data root.
    invalid_name,
    store_not_found,
    store_type_mismatch,
    unsupported_operation,
    not_found,
    /// Anything without a dedicated code; the detail keeps the original name.
    internal,

    pub fn wireName(self: Code) []const u8 {
        return switch (self) {
            .data_dir_not_configured => "DATA_DIR_NOT_CONFIGURED",
            .data_dir_not_mounted => "DATA_DIR_NOT_MOUNTED",
            .storage_config_invalid => "STORAGE_CONFIG_INVALID",
            .invalid_name => "INVALID_NAME",
            .store_not_found => "STORE_NOT_FOUND",
            .store_type_mismatch => "STORE_TYPE_MISMATCH",
            .unsupported_operation => "UNSUPPORTED_OPERATION",
            .not_found => "NOT_FOUND",
            .internal => "STORAGE_INTERNAL",
        };
    }

    pub fn fromWireName(name: []const u8) ?Code {
        inline for (@typeInfo(Code).@"enum".fields) |field| {
            const code: Code = @enumFromInt(field.value);
            if (std.mem.eql(u8, code.wireName(), name)) return code;
        }
        return null;
    }

    /// Human sentence for the code, used when the detail is not helpful.
    pub fn description(self: Code) []const u8 {
        return switch (self) {
            .data_dir_not_configured => "microservice has no data directory in the storage mount configuration",
            .data_dir_not_mounted => "data directory of the microservice is not mounted",
            .storage_config_invalid => "storage mount configuration is missing or invalid",
            .invalid_name => "microservice or store name is not a valid path segment",
            .store_not_found => "store is not open",
            .store_type_mismatch => "store already exists with a different type",
            .unsupported_operation => "operation is not supported by this store type",
            .not_found => "requested entry does not exist",
            .internal => "storage operation failed",
        };
    }
};

/// Classifies a storage error. Errors that describe a data-directory problem
/// keep their own code so a client can tell "your volume is not attached"
/// apart from an ordinary failed operation.
pub fn codeForError(err: anyerror) Code {
    return switch (err) {
        error.DataDirNotConfigured => .data_dir_not_configured,
        error.DataDirNotMounted => .data_dir_not_mounted,
        error.StorageConfigMissing,
        error.StorageConfigNotFound,
        error.InvalidStorageConfig,
        => .storage_config_invalid,
        error.InvalidName => .invalid_name,
        error.StoreNotFound => .store_not_found,
        error.StoreTypeMismatch => .store_type_mismatch,
        error.UnsupportedOperation => .unsupported_operation,
        error.NotFound, error.FileNotFound => .not_found,
        else => .internal,
    };
}

/// Wire text for an error: `CODE: OriginalErrorName`. The buffer has to hold
/// the longest code plus the error name; `max_text_len` is a safe size.
pub const max_text_len = 128;

pub fn writeText(buf: []u8, err: anyerror) []const u8 {
    const code = codeForError(err);
    return std.fmt.bufPrint(buf, "{s}: {s}", .{ code.wireName(), @errorName(err) }) catch
        code.wireName();
}

pub const Parsed = struct {
    code: Code,
    detail: []const u8,
};

/// Splits wire text back into a code and its detail. Text produced by an older
/// peer has no code prefix, so it is reported as `internal` with the text kept
/// intact rather than dropped.
pub fn parseText(text: []const u8) Parsed {
    const separator = std.mem.indexOf(u8, text, ": ") orelse
        return .{ .code = Code.fromWireName(text) orelse .internal, .detail = text };
    const code = Code.fromWireName(text[0..separator]) orelse
        return .{ .code = .internal, .detail = text };
    return .{ .code = code, .detail = text[separator + 2 ..] };
}

test "data directory failures keep their own codes" {
    try std.testing.expectEqual(Code.data_dir_not_configured, codeForError(error.DataDirNotConfigured));
    try std.testing.expectEqual(Code.data_dir_not_mounted, codeForError(error.DataDirNotMounted));
    try std.testing.expectEqual(Code.storage_config_invalid, codeForError(error.InvalidStorageConfig));
    try std.testing.expectEqual(Code.internal, codeForError(error.OutOfMemory));
}

test "wire text round trips through the code catalogue" {
    var buf: [max_text_len]u8 = undefined;
    const text = writeText(&buf, error.DataDirNotMounted);
    try std.testing.expectEqualStrings("DATA_DIR_NOT_MOUNTED: DataDirNotMounted", text);

    const parsed = parseText(text);
    try std.testing.expectEqual(Code.data_dir_not_mounted, parsed.code);
    try std.testing.expectEqualStrings("DataDirNotMounted", parsed.detail);
}

test "text from a peer without codes stays readable" {
    const parsed = parseText("StoreNotFound");
    try std.testing.expectEqual(Code.internal, parsed.code);
    try std.testing.expectEqualStrings("StoreNotFound", parsed.detail);

    const legacy = parseText("open failed: something odd");
    try std.testing.expectEqual(Code.internal, legacy.code);
    try std.testing.expectEqualStrings("open failed: something odd", legacy.detail);
}

test "every code has a distinct wire name" {
    for (std.enums.values(Code)) |code| {
        try std.testing.expectEqual(code, Code.fromWireName(code.wireName()).?);
    }
    try std.testing.expect(Code.fromWireName("NO_SUCH_CODE") == null);
}
