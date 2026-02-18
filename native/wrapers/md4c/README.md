# MD4C Wrapper

This is a Zig-based wrapper for the [MD4C](https://github.com/mity/md4c) Markdown parser, specifically designed for usage with Bun FFI.

## Structure

- `src/main.zig`: The Zig wrapper code that exports C-compatible functions (`md4c_to_html`, `md4c_free`).
- `build.zig`: Zig build script to compile md4c as a shared library.
- `vendor/md4c`: The upstream md4c source code.

## Building

Run `zig build` to build the shared library.
