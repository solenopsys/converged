const std = @import("std");

/// libc-backed mutex kept deliberately small so ptah can use the same lock in
/// host builds and in the worker threads that call native C/C++ wrappers.
pub const Mutex = struct {
    raw: std.c.pthread_mutex_t = std.c.PTHREAD_MUTEX_INITIALIZER,

    pub fn lock(self: *Mutex) void {
        std.debug.assert(std.c.pthread_mutex_lock(&self.raw) == .SUCCESS);
    }

    pub fn unlock(self: *Mutex) void {
        std.debug.assert(std.c.pthread_mutex_unlock(&self.raw) == .SUCCESS);
    }
};
