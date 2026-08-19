

const own = /^(src\/|[\w.-]+\.ts\()/;

const proc = Bun.spawn(["bunx", "tsc", "--noEmit"], {
  cwd: import.meta.dir,
  stdout: "pipe",
  stderr: "pipe",
});
const output = (await new Response(proc.stdout).text()) +
  (await new Response(proc.stderr).text());
await proc.exited;

const diagnostics = output
  .split("\n")
  .filter((line) => line.includes("error TS"));
const ours = diagnostics.filter((line) => own.test(line));
const workspace = diagnostics.filter((line) => !own.test(line));

if (workspace.length > 0) {
  const files = new Set(workspace.map((line) => line.split("(")[0]));
  console.log(
    `known workspace debt: ${workspace.length} diagnostics in ${files.size} library files (${[...files].join(", ")})`,
  );
}

if (ours.length === 0) {
  console.log("minimal: no type errors");
  process.exit(0);
}

for (const line of ours) console.error(line);
process.exit(1);
