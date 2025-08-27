ALTER TABLE recordings
ADD COLUMN type TEXT CHECK (type IN ('screen', 'region', 'window'));

-- milliseconds
ALTER TABLE recordings
ADD COLUMN length INTEGER;

-- bytes
ALTER TABLE recordings
ADD COLUMN size INTEGER;

ALTER TABLE recordings
ADD COLUMN deleted_at DATETIME;

ALTER TABLE recordings
ADD COLUMN last_opened_at DATETIME;