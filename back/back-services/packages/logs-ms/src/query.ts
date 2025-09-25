import { query } from "@lithdew/chdb-bun";

export class Query {
  exec(sql: string) { 
    console.log("Executing SQL:", sql);
    try {
      const result = query(sql);
      console.log("Query successful, rows:", result.data?.length || 0);
      return result;
    } catch (error) {
      console.error("Query failed:", error);
      throw error;
    }
  }

  // Test file existence and basic structure
  testFiles() {
    console.log("=== Testing Parquet files ===");
    const files = ['logs_2025-09-02.parquet'];
    for (const file of files) {
      try {
        console.log(`--- Testing file: ${file} ---`);
        const countResult = this.exec(`
          SET storage_file_read_method = 'pread';
          SET input_format_parquet_allow_missing_columns = 1;
          
          SELECT service
          FROM file('./data/parquet/${file}', 'Parquet',
                    'timestamp Int64, service String, level String, message String, metadata String')
        `);
        console.log(`Total rows in ${file}:`, countResult.data);
      } catch (error) {
        console.error(`Failed to count rows in ${file}:`, error);
        return false;
      }
    }

    // Test schema description
    try {
      const schemaResult = this.exec(`
        SET storage_file_read_method = 'pread';
        SET input_format_parquet_allow_missing_columns = 1;
        
        DESCRIBE file('./data/parquet/logs_*.parquet', 'Parquet',
                     'timestamp Int64, service String, level String, message String, metadata String')
      `);
      console.log("Schema description:", schemaResult.data);
    } catch (error) {
      console.error("Failed to describe schema:", error);
      return false;
    }

    return true;
  }

  // Test individual files (known files from test data)
  testIndividualFiles() {
    console.log("=== Testing individual files ===");
    
    // Test known files from our test data
    const knownFiles = ['logs_2025-09-01.parquet', 'logs_2025-09-02.parquet'];
    
    for (const fileName of knownFiles) {
      console.log(`\n--- Testing file: ${fileName} ---`);
      
      try {
        // Test file structure
        const fileTest = this.exec(`
          SET storage_file_read_method = 'pread';
          SET input_format_parquet_allow_missing_columns = 1;
          
          SELECT COUNT(*) as count, 
                 MIN(timestamp) as min_ts, 
                 MAX(timestamp) as max_ts
          FROM file('./data/parquet/${fileName}', 'Parquet', 
                   'timestamp Int64, service String, level String, message String, metadata String')
        `);
        console.log(`File ${fileName} stats:`, fileTest.data?.[0] || "No data");

        // Test services in this file
        const services = this.exec(`
          SET storage_file_read_method = 'pread';
          SET input_format_parquet_allow_missing_columns = 1;
          
          SELECT service, COUNT(*) as count
          FROM file('./data/parquet/${fileName}', 'Parquet', 
                   'timestamp Int64, service String, level String, message String, metadata String')
          GROUP BY service
          ORDER BY service
        `);
        console.log(`Services in ${fileName}:`, services.data);

      } catch (error) {
        console.error(`Failed to test file ${fileName}:`, error);
      }
    }
  }

  getErrors(hours = 24) {
    console.log(`=== Getting errors for last ${hours} hours ===`);
    const since = Date.now() - hours * 3600 * 1000;
    
    return this.exec(`
      SET storage_file_read_method = 'pread';
      SET input_format_parquet_allow_missing_columns = 1;

      SELECT timestamp, service, message
      FROM file(
        './data/parquet/logs_*.parquet',
        'Parquet',
        'timestamp Int64, service String, level String, message String, metadata String'
      )
      WHERE level = 'ERROR' AND timestamp > ${since}
      ORDER BY timestamp DESC
    `);
  }

  getByService(service: string) {
    console.log(`=== Getting logs for service: ${service} ===`);
    const svc = service.replace(/'/g, "''");
    
    // First, let's see what services exist
    try {
      const servicesResult = this.exec(`
        SET storage_file_read_method = 'pread';
        SET input_format_parquet_allow_missing_columns = 1;
        
        SELECT service, COUNT(*) as count
        FROM file(
          './data/parquet/logs_*.parquet',
          'Parquet',
          'timestamp Int64, service String, level String, message String, metadata String'
        )
        GROUP BY service
        ORDER BY service
      `);
      console.log("Available services:", servicesResult.data);
    } catch (error) {
      console.error("Failed to get services list:", error);
    }

    // Now try the actual query
    return this.exec(`
      SET storage_file_read_method = 'pread';
      SET input_format_parquet_allow_missing_columns = 1;

      SELECT timestamp, level, message
      FROM file(
        './data/parquet/logs_*.parquet',
        'Parquet',
        'timestamp Int64, service String, level String, message String, metadata String'
      )
      WHERE service = '${svc}'
      ORDER BY timestamp DESC
      LIMIT 1000
    `);
  }

  // Safe version that tests files first
  getByServiceSafe(service: string) {
    console.log(`=== Safe query for service: ${service} ===`);
    
    // Test files first
    if (!this.testFiles()) {
      throw new Error("File tests failed, aborting query");
    }

    return this.getByService(service);
  }

  // Quick test method - just try to read some data
  quickTest() {
    console.log("=== Quick Test ===");
    
    try {
      const result = this.exec(`
        SET storage_file_read_method = 'pread';
        SET input_format_parquet_allow_missing_columns = 1;
        
        SELECT * 
        FROM file('./data/parquet/logs_*.parquet', 'Parquet',
                  'timestamp Int64, service String, level String, message String, metadata String')
        LIMIT 5
      `);
      
      console.log("Sample data:", result.data);
      return true;
    } catch (error) {
      console.error("Quick test failed:", error);
      return false;
    }
  }
}