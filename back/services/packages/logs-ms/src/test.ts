// test.ts
import { Dumper } from "./dumper";
import { Query } from "./query";

async function main() {
  console.log("=== Parquet Debug ===\n");

  const dumper = new Dumper();
  await dumper.init();

  console.log("1) Create test files …");
  // await dumper.dumpTest();
  console.log("✓ Test parquet written\n");

  const q = new Query();

  console.log("2) Basic file tests …");
  if (!q.testFiles()) {
    console.error("✗ Basic tests failed");
    return;
  }
  console.log("✓ Basic tests OK\n");

  console.log("3) Individual files …");
  q.testIndividualFiles();
  console.log("✓ Individual OK\n");

  console.log("4) Query by service (safe) …");
  const r1 = q.getByServiceSafe("redis");
  console.log("Rows(redis):", r1.data?.length ?? 0, r1.data?.slice(0, 2), "\n");

  console.log("5) getErrors(24h) …");
  const r2 = q.getErrors(24);
  console.log("Rows(errors):", r2.data?.length ?? 0, r2.data?.slice(0, 3), "\n");

  console.log("6) nginx …");
  const r3 = q.getByServiceSafe("nginx");
  console.log("Rows(nginx):", r3.data?.length ?? 0);

  console.log("\n=== Done ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
