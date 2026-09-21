const std = @import("std");

pub const Entry = struct {
    section: []u8,
    id: []u8,
    language: []u8,
    vector: []f32,
};

pub const Index = struct {
    allocator: std.mem.Allocator,
    entries: std.ArrayList(Entry) = .empty,
    commands: usize = 0,

    pub fn deinit(self: *Index) void {
        self.clear();
        self.entries.deinit(self.allocator);
    }

    pub fn clear(self: *Index) void {
        for (self.entries.items) |entry| {
            self.allocator.free(entry.section);
            self.allocator.free(entry.id);
            self.allocator.free(entry.language);
            self.allocator.free(entry.vector);
        }
        self.entries.clearRetainingCapacity();
        self.commands = 0;
    }
};

pub const Contexts = struct {
    allocator: std.mem.Allocator,
    items: std.StringHashMapUnmanaged(*Index) = .empty,

    pub fn deinit(self: *Contexts) void {
        var iterator = self.items.iterator();
        while (iterator.next()) |entry| {
            entry.value_ptr.*.deinit();
            self.allocator.destroy(entry.value_ptr.*);
            self.allocator.free(entry.key_ptr.*);
        }
        self.items.deinit(self.allocator);
    }
};
