import { query, Connection } from "@lithdew/chdb-bun";


export class Query {
  exec(sql: string) {
    return query(sql);
  }
  
  getErrors(hours = 24) {
    const since = Date.now() - hours * 3600 * 1000;
    return this.exec(`
      SELECT timestamp, service, message 
      FROM file('./data/parquet/logs_*.parquet', 'Parquet')
      WHERE level = 'ERROR' AND timestamp > ${since}
      ORDER BY timestamp DESC
    `);
  }
  
  getByService(service: string) {
    return this.exec(`
      SELECT timestamp, level, message
      FROM file('./data/parquet/logs_*.parquet', 'Parquet') 
      WHERE service = '${service}'
      ORDER BY timestamp DESC
      LIMIT 1000
    `);
  }
}
 