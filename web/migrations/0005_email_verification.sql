-- Sign-up email verification.
-- A new account can only sign in after it proves it owns the address by entering
-- a single-use code that was emailed to it. Sign-in itself is password only.

ALTER TABLE users ADD COLUMN email_verified_at TEXT;

CREATE TABLE IF NOT EXISTS signup_otp_challenges (
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

CREATE INDEX IF NOT EXISTS idx_signup_otp_user ON signup_otp_challenges(user_id, issued_at);
CREATE INDEX IF NOT EXISTS idx_signup_otp_email ON signup_otp_challenges(email, issued_at);

-- Accounts that existed before verification was introduced keep working.
UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;

DROP TABLE IF EXISTS login_otp_challenges;
