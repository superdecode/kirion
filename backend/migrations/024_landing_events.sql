-- Landing page analytics events
CREATE TABLE IF NOT EXISTS landing_events (
  id         BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(50)  NOT NULL,
  payload    JSONB,
  ip         VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landing_events_type ON landing_events (event_type);
CREATE INDEX IF NOT EXISTS idx_landing_events_created_at ON landing_events (created_at DESC);
