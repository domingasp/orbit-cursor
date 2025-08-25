ALTER TABLE recordings
ADD COLUMN has_system_cursor INTEGER NOT NULL DEFAULT 0 CHECK (has_system_cursor IN (0, 1));