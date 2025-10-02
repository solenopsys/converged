CREATE TABLE IF NOT EXISTS application_logs (
    timestamp DateTime64(3),
    level String,
    service String,
    request_id UUID,
    user_id UInt64,
    response_time_ms UInt32,
    status_code UInt16,
    error_count UInt8,
    cpu_usage Float32,
    memory_mb Float64
) ENGINE = MergeTree()
ORDER BY timestamp;

INSERT INTO application_logs FORMAT Native
