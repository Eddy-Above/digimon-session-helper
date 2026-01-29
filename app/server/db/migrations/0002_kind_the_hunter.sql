-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table
-- This migration makes the 'type' column nullable

PRAGMA foreign_keys=off;

-- Create new table with type as nullable
CREATE TABLE digimon_new (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  stage TEXT NOT NULL,
  attribute TEXT NOT NULL,
  family TEXT NOT NULL,
  type TEXT,
  size TEXT NOT NULL DEFAULT 'medium',
  base_stats TEXT NOT NULL,
  attacks TEXT NOT NULL,
  qualities TEXT NOT NULL,
  data_optimization TEXT,
  base_dp INTEGER NOT NULL,
  bonus_dp INTEGER NOT NULL DEFAULT 0,
  current_wounds INTEGER NOT NULL DEFAULT 0,
  current_stance TEXT NOT NULL DEFAULT 'neutral',
  evolution_path_ids TEXT NOT NULL,
  partner_id TEXT REFERENCES tamers(id),
  is_enemy INTEGER NOT NULL DEFAULT false,
  notes TEXT NOT NULL DEFAULT '',
  sprite_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Copy data from old table
INSERT INTO digimon_new SELECT * FROM digimon;

-- Drop old table
DROP TABLE digimon;

-- Rename new table
ALTER TABLE digimon_new RENAME TO digimon;

PRAGMA foreign_keys=on;
