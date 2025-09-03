import { dlopen, FFIType } from "bun:ffi";

const lib = dlopen("./libmyzig.so", {
  add: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 },
});

console.log(lib.symbols.add(2, 3)); // 5
