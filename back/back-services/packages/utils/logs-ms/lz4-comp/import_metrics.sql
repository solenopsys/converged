CREATE TABLE IF NOT EXISTS metrics (
    timestamp DateTime,
    metric_name String,
    value Float64,
    host String,
    datacenter String
) ENGINE = MergeTree()
ORDER BY timestamp;

INSERT INTO metrics FORMAT Native
