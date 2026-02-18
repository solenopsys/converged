import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import { Database } from "../src/index";
import { rmSync, existsSync } from "fs";
import { join } from "path";

const DB_PATH = join(process.cwd(), "test_db");

describe("LMDBX Database", () => {
  beforeAll(() => {
    if (existsSync(DB_PATH)) {
        // MDBX usually creates a file or directory. Using recursive delete just in case.
        rmSync(DB_PATH, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    if (existsSync(DB_PATH)) {
        rmSync(DB_PATH, { recursive: true, force: true });
    }
    if (existsSync(DB_PATH + "-lock")) {
         rmSync(DB_PATH + "-lock", { recursive: true, force: true });
    }
  });

  it("should perform basic CRUD operations", () => {
    const db = new Database(DB_PATH);

    // Put
    const key = "greeting";
    const value = "Hello, Bun!";
    db.put(key, value);

    // Get
    const retrieved = db.get(key);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.toString()).toBe(value);

    // Delete
    db.delete(key);
    expect(db.get(key)).toBeNull();

    db.close();
  });

  it("should handle binary data", () => {
    const db = new Database(DB_PATH);
    const key = Buffer.from([0, 1, 2]);
    const value = Buffer.from([255, 254, 253]);

    db.put(key, value);
    const retrieved = db.get(key);
    
    expect(retrieved).not.toBeNull();
    expect(retrieved).toEqual(value);
    
    db.close();
  });
  
  it("should support transactions", () => {
      const db = new Database(DB_PATH);
      const key = "txn_test";
      
      // Commit
      db.transaction(() => {
          db.put(key, "committed");
      });
      expect(db.get(key)?.toString()).toBe("committed");
      
      // Abort (manual or via error in transaction wrapper if wrapper supported it fully, 
      // but the wrapper in lmdbx.ts catches error and aborts)
      try {
          db.transaction(() => {
              db.put(key, "aborted");
              throw new Error("Abort me");
          });
      } catch (e) {
          // expected
      }
      expect(db.get(key)?.toString()).toBe("committed");
      
      db.close();
  });
});
