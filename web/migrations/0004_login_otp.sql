-- One-time codes for password + email-code sign-in.
-- Only a hash of the code is stored, the code itself is never persisted.

CREATE TABLE IF NOT EXISTS login_otp_challenges (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  ip          TEXT,
  issued_at   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  consumed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_otp_user ON login_otp_challenges(user_id, issued_at);
CREATE INDEX IF NOT EXISTS idx_login_otp_email ON login_otp_challenges(email, issued_at);
