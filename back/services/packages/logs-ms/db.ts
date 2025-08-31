// Устанавливаем chdb (через npm)
import chdb from "chdb";

// Простейший SQL: считаем числа
const result = chdb.query("SELECT 1+2 AS sum, 'hello' AS msg");
console.log(result);
// => [ { sum: 3, msg: 'hello' } ]

// Читаем CSV
const csvResult = chdb.query(`
    SELECT name, age
    FROM file('people.csv', 'CSVWithNames')
    WHERE age > 30
`);
console.log(csvResult);

// Читаем Parquet
const parquetResult = chdb.query(`
    SELECT level, count() AS cnt
    FROM file('logs_2025-08-30.parquet', 'Parquet')
    WHERE level = 'ERROR'
    GROUP BY level
`);
console.log(parquetResult);
