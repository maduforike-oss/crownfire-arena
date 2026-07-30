CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  handle VARCHAR(24) NOT NULL UNIQUE,
  display_name VARCHAR(32) NOT NULL,
  guest BOOLEAN NOT NULL DEFAULT TRUE,
  crowns INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  linked_email VARCHAR(254) UNIQUE,
  linked_google_sub TEXT UNIQUE,
  linked_apple_sub TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS friendships (
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status VARCHAR(12) NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY,
  room_code VARCHAR(6) NOT NULL,
  map_id VARCHAR(32) NOT NULL,
  mode_id VARCHAR(32) NOT NULL,
  reason TEXT NOT NULL,
  winner_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_participants (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  seat SMALLINT NOT NULL CHECK (seat BETWEEN 0 AND 3),
  display_name VARCHAR(32) NOT NULL,
  character_id VARCHAR(24) NOT NULL,
  placement SMALLINT NOT NULL CHECK (placement BETWEEN 1 AND 4),
  kills INTEGER NOT NULL DEFAULT 0,
  deaths INTEGER NOT NULL DEFAULT 0,
  bombs_placed INTEGER NOT NULL DEFAULT 0,
  runes_collected INTEGER NOT NULL DEFAULT 0,
  shards INTEGER NOT NULL DEFAULT 0,
  survival_ms INTEGER NOT NULL DEFAULT 0,
  won BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (match_id, seat)
);

CREATE INDEX IF NOT EXISTS match_participants_profile_idx
  ON match_participants(profile_id, match_id);

CREATE INDEX IF NOT EXISTS matches_ended_idx ON matches(ended_at DESC);
