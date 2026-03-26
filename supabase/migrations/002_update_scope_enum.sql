ALTER TYPE scope RENAME TO scope_old;

CREATE TYPE scope AS ENUM (
  'Plumbing Piping',
  'HVAC Piping',
  'HVAC Ductwork',
  'Fire Stopping',
  'Equipment',
  'Other'
);

ALTER TABLE bids
  ALTER COLUMN scope TYPE scope
  USING scope::text::scope;

DROP TYPE scope_old;
