import { createWriteStream, WriteStream } from "node:fs";
import { dirname } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

type NativeScalar =
  | "UInt8" | "UInt16" | "UInt32" | "UInt64"
  | "Int8"  | "Int16"  | "Int32"  | "Int64"
  | "Float32" | "Float64"
  | "String";

type ColumnSpec = { name: string; type: NativeScalar };

function ensureDir(filePath: string) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/** ClickHouse VarUInt (LEB128-подобная) */
function encodeVarUInt(n: number | bigint): Buffer {
  let x = typeof n === "bigint" ? n : BigInt(n >>> 0);
  const out: number[] = [];
  while (true) {
    let b = Number(x & 0x7Fn);
    x >>= 7n;
    if (x !== 0n) b |= 0x80;
    out.push(b);
    if ((b & 0x80) === 0) break;
  }
  return Buffer.from(out);
}

function u64LE(n: number | bigint): Buffer {
  let x = typeof n === "bigint" ? n : BigInt(n);
  if (x < 0n) throw new Error("UInt64 must be >= 0");
  const buf = Buffer.allocUnsafe(8);
  for (let i = 0; i < 8; i++) { buf[i] = Number(x & 0xFFn); x >>= 8n; }
  return buf;
}
function i64LE(n: number | bigint): Buffer {
  let x = typeof n === "bigint" ? n : BigInt(Math.trunc(n as number));
  const buf = Buffer.allocUnsafe(8);
  for (let i = 0; i < 8; i++) { buf[i] = Number(x & 0xFFn); x >>= 8n; }
  return buf;
}
function u32LE(n: number): Buffer { const b = Buffer.allocUnsafe(4); b.writeUInt32LE(n >>> 0, 0); return b; }
function i32LE(n: number): Buffer { const b = Buffer.allocUnsafe(4); b.writeInt32LE(n | 0, 0); return b; }
function u16LE(n: number): Buffer { const b = Buffer.allocUnsafe(2); b.writeUInt16LE(n & 0xFFFF, 0); return b; }
function i16LE(n: number): Buffer { const b = Buffer.allocUnsafe(2); b.writeInt16LE((n << 16) >> 16, 0); return b; }
function u8(n: number): Buffer    { return Buffer.from([n & 0xFF]); }
function i8(n: number): Buffer    { return Buffer.from([((n & 0xFF) ^ 0x80) - 0x80]); }
function f32LE(n: number): Buffer { const b = Buffer.allocUnsafe(4); b.writeFloatLE(n, 0); return b; }
function f64LE(n: number): Buffer { const b = Buffer.allocUnsafe(8); b.writeDoubleLE(n, 0); return b; }

/** Сериализация одной колонки */
function encodeColumnData(type: NativeScalar, values: any[]): Buffer {
  const parts: Buffer[] = [];
  switch (type) {
    case "UInt8":   for (const v of values) parts.push(u8(Number(v))); break;
    case "UInt16":  for (const v of values) parts.push(u16LE(Number(v))); break;
    case "UInt32":  for (const v of values) parts.push(u32LE(Number(v))); break;
    case "UInt64":  for (const v of values) parts.push(u64LE(typeof v === "bigint" ? v : BigInt(v))); break;

    case "Int8":    for (const v of values) parts.push(i8(Number(v))); break;
    case "Int16":   for (const v of values) parts.push(i16LE(Number(v))); break;
    case "Int32":   for (const v of values) parts.push(i32LE(Number(v))); break;
    case "Int64":   for (const v of values) parts.push(i64LE(typeof v === "bigint" ? v : BigInt(v))); break;

    case "Float32": for (const v of values) parts.push(f32LE(Number(v))); break;
    case "Float64": for (const v of values) parts.push(f64LE(Number(v))); break;

    case "String": {
      // ColumnString (Native): сначала offsets (UInt64 на строку, накопительные),
      // затем общий буфер chars, где каждая строка заканчивается 0x00.
      const offsets: Buffer[] = [];
      const chunks: Buffer[] = [];
      let acc = 0n;
      for (const v of values) {
        let s: string;
        if (v === null || v === undefined) s = "";
        else if (typeof v === "string") s = v;
        else if (typeof v === "object") s = JSON.stringify(v);
        else s = String(v);
        const bytes = Buffer.from(s, "utf8");
        const withNull = Buffer.allocUnsafe(bytes.length + 1);
        bytes.copy(withNull, 0);
        withNull[bytes.length] = 0x00;
        chunks.push(withNull);
        acc += BigInt(withNull.length);
        offsets.push(u64LE(acc));
      }
      parts.push(Buffer.concat(offsets));
      parts.push(Buffer.concat(chunks));
      break;
    }

    default:
      throw new Error(`Type not implemented: ${type}`);
  }
  return Buffer.concat(parts);
}

export class NativeWriter {
  private stream: WriteStream | null = null;
  constructor(private filePath: string, private schema: ColumnSpec[]) {}

  async open() {
    ensureDir(this.filePath);
    this.stream = createWriteStream(this.filePath, { flags: "a" });
    await new Promise<void>((r) => this.stream!.once("open", () => r()));
  }

  /** rows — массив объектов с полями ровно по schema (column-major запись) */
  async append(rows: Record<string, any>[]) {
    if (!this.stream) throw new Error("Writer not opened");
    const nCols = this.schema.length;
    const nRows = rows.length;
    if (nRows === 0) return;

    const header: Buffer[] = [];
    header.push(encodeVarUInt(nCols));  // VarUInt columns
    header.push(encodeVarUInt(nRows));  // VarUInt rows

    for (const col of this.schema) {
      // имена и типы — как ClickHouse String (VarUInt(len)+bytes)
      const nameBytes = Buffer.from(col.name, "utf8");
      header.push(encodeVarUInt(nameBytes.length), nameBytes);
      const typeBytes = Buffer.from(col.type, "utf8");
      header.push(encodeVarUInt(typeBytes.length), typeBytes);
    }

    const data: Buffer[] = [];
    for (const col of this.schema) {
      const values = rows.map((r) => r[col.name]);
      data.push(encodeColumnData(col.type, values));
    }

    const block = Buffer.concat([...header, ...data]);
    await new Promise<void>((resolve, reject) => {
      this.stream!.write(block, (err) => (err ? reject(err) : resolve()));
    });
  }

  async close() {
    if (!this.stream) return;
    await new Promise<void>((r) => this.stream!.end(r));
    this.stream = null;
  }
}
