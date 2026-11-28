CREATE TABLE IF NOT EXISTS ai_usage (
  uid TEXT NOT NULL,
  day TEXT NOT NULL,
  feature TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  PRIMARY KEY (uid, day, feature)
);
