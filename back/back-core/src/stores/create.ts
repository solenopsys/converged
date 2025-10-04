import { LMWrapper } from "../utils/lmwrapper";
import { join } from "path";
import { mkdirSync, existsSync } from "fs";
import { readFile, writeFile, mkdir } from "fs/promises";
import { StoreType } from "./types";
import { DATA_DIR } from "./types";
import { StoreManifest } from "./manifest";
import {Store} from "./types";

// Создает или загружает манифест
async function createOrLoadManifest(dir: string, manifest?: StoreManifest): Promise<StoreManifest> {
  const manifestPath = join(dir, 'manifest.json');
  
  if (existsSync(manifestPath)) {
    const data = await readFile(manifestPath, 'utf-8');
    return JSON.parse(data);
  }
  
  if (!manifest) throw new Error("Manifest not found and no template provided");
  
  await mkdir(dir, { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  
  return manifest;
}

async function createStore(msName: string, dbName: string, type: StoreType): Promise<Store> {
  const dir = join(DATA_DIR, msName, dbName);
  
  const manifest = await createOrLoadManifest(dir, {
    name: msName,
    dataLocation: join(dir, "db"),
    version: dbName,
    type: type,
    migrations: []
  });

  if (type === StoreType.KVS ) {
    return new LMWrapper(manifest.dataLocation, "db");
  }

  if (type === StoreType.SQL ) {
    return new LMWrapper(manifest.dataLocation, "db");
  }
  
  throw new Error(`Store type ${type} not implemented`);
}

export { createStore };