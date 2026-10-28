-- Anonymous play statistics (docs/online/public-launch-plan.md §4). One row per event; `data` is
-- the event's JSON fields, checked against src/analytics/events.ts before it is written.
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- When it happened (the browser's clock, kept only when within a day of the server's).
  at INTEGER NOT NULL,
  -- When the server wrote it.
  received INTEGER NOT NULL,
  -- The day in Taiwan time (YYYY-MM-DD), for daily charts.
  day TEXT NOT NULL,
  -- The browser's random analytics id (not the seat token).
  client TEXT NOT NULL,
  name TEXT NOT NULL,
  data TEXT NOT NULL,
  -- Two-letter country from Cloudflare; no IP address is kept.
  country TEXT
);
CREATE INDEX events_name_day ON events (name, day);
CREATE INDEX events_client ON events (client, at);
