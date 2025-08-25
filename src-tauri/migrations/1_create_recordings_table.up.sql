CREATE TABLE
  IF NOT EXISTS recordings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recording_directory TEXT NOT NULL UNIQUE,
    origin_x REAL NOT NULL,
    origin_y REAL NOT NULL,
    scale_factor REAL NOT NULL,
    has_camera INTEGER NOT NULL DEFAULT 0 CHECK (has_camera IN (0, 1)),
    has_system_audio INTEGER NOT NULL DEFAULT 0 CHECK (has_system_audio IN (0, 1)),
    has_microphone INTEGER NOT NULL DEFAULT 0 CHECK (has_microphone IN (0, 1)),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );