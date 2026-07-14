# ptah

Native Zig hub for production slicer and CAM work. It has no transport or UI
yet: callers submit JSON tasks, call `Hub.tick()`, and inspect task status.

The plugins are Zig modules compiled into the hub. They load only the existing
native wrapper libraries at runtime:

- `curaengine` -> `libcuraengine.so`
- `opencamlib` -> `libopencamlib.so`

QuickJS is a control-plane policy engine. It gets task metadata and returns
`start`, `defer`, or `cancel`; idle policy returns `unload` or `keep`. The JS
runtime has no direct access to plugin pointers or native wrapper calls.

`unload` releases the worker and task state. The wrapper image remains mapped
until process exit because OpenCAMLib uses C++ runtime exit/TLS handlers that
are unsafe to invalidate with `dlclose` after use.

Build and validate:

```bash
zig build -Doptimize=ReleaseFast
zig build test -Doptimize=ReleaseFast
```

The build installs `libqjs.so` beside the executable. Default paths are
relative to this directory; optional positional arguments override them:

```bash
./zig-out/bin/ptah [qjs-lib] [curaengine-lib] [opencamlib-lib]
```

At startup ptah announces itself to Fujin through a ZMQ `DEALER` client. Its
endpoint and wrapper path are configured with `PTAH_FUJIN_ZMQ_ENDPOINT` and
`PTAH_FUJIN_ZIMQ_LIB`, with `FUJIN_ZMQ_ENDPOINT` and `FUJIN_ZIMQ_LIB` as shared
fallbacks. Set `PTAH_FUJIN_LISTEN=on` to keep the process alive as a Fujin
client after `Hub.tick()`; the default remains one-shot.

Task schemas are owned by the built-in plugin modules. Cura tasks use
`stlPath`, `definitionPath`, `gcodePath`, optional `settings`, `searchFiles`,
`enginePath`, and `threads`. OpenCAMLib tasks use `stlPath`, optional
`gcodePath`, and tool/path parameters (`toolDiameter`, `stepover`, `feed`,
and related numeric fields).
