import fs from "fs";

const listSubdirs = () => {
  const dir = "./packages";
  const files = fs.readdirSync(dir);
  return files.filter((file) => fs.statSync(`${dir}/${file}`).isDirectory());
};

for (const dir of listSubdirs()) {
  console.log("Building", dir);
  const result = Bun.spawnSync(["bun", "bld"], {
    cwd: `./packages/${dir}`
  });
  if (result.exitCode !== 0) {
    console.error("Failed to build", dir);
    process.exit(1);
  }
}