// bun add parquet-wasm apache-arrow
import initWasm, {
    Table, WriterPropertiesBuilder, Compression, writeParquet
  } from "parquet-wasm";
  import { tableFromArrays, Uint8Vector, Utf8Vector, BigInt64Vector } from "apache-arrow";
  import { writeFile } from "node:fs/promises";
  
  await initWasm(); // инициализация WASM
  
  // 1) Собираем Arrow-таблицу (пример: логи)
  const table = tableFromArrays({
    ts: BigInt64Vector.from([BigInt(Date.now())]),
    level: Utf8Vector.from(["INFO"]),
    msg: Utf8Vector.from(["hello from bun"]),
  });
  
  // 2) Настраиваем writer (ZSTD компрессия)
  const props = new WriterPropertiesBuilder()
    .setCompression(Compression.ZSTD)
    .build();
  
  // 3) Пишем Parquet в память и сохраняем на диск
  const bytes = writeParquet(Table.from(table), props);
  await writeFile("./logs.parquet", bytes);
  