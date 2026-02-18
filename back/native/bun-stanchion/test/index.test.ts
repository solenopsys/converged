import { describe, it, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { loadStanchion, StanchionDatabase } from "../src/index";

const CREATE_MONSTERS = `
CREATE VIRTUAL TABLE dnd_monsters
USING stanchion (
  id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  challenge_rating FLOAT NOT NULL,
  SORT KEY (id)
);
`;

const INSERT_MONSTERS = `
INSERT INTO dnd_monsters (id, name, type, size, challenge_rating)
VALUES
  (1, 'Beholder', 'ABERRATION', 4, 13),
  (2, 'Gelatinous Cube', 'OOZE', 4, 2),
  (3, 'Mimic', 'MONSTROSITY', 3, 2),
  (4, 'Lich', 'UNDEAD', 3, 21);
`;

describe("bun-stanchion", () => {
  it("loads the extension and queries stanchion tables", () => {
    const db = new StanchionDatabase(":memory:");
    db.exec(CREATE_MONSTERS);
    db.exec(INSERT_MONSTERS);

    const rows = db
      .query("SELECT name FROM dnd_monsters WHERE type = 'UNDEAD' AND challenge_rating >= 18")
      .all() as Array<{ name: string }>;

    expect(rows).toEqual([{ name: "Lich" }]);
    db.close();
  });

  it("loads into an existing bun:sqlite Database", () => {
    const db = new Database(":memory:");
    loadStanchion(db);
    db.exec(CREATE_MONSTERS);
    db.close();
  });
});
