CREATE TABLE IF NOT EXISTS test_data (
    value Int32,
    message String
) ENGINE = MergeTree()
ORDER BY value;

INSERT INTO test_data FORMAT Native