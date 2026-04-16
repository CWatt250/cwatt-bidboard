-- Replace all clients with the canonical 21-client list.
-- CASCADE on bid_clients FK will clear existing bid-client associations.
TRUNCATE clients CASCADE;

INSERT INTO clients (name) VALUES
  ('Alden Mechanical'),
  ('Alliant Systems'),
  ('Apollo'),
  ('Archer Mechanical'),
  ('Betschart'),
  ('Bruce Mechanical'),
  ('Coatings Unlimited'),
  ('Columbia Allied Systems'),
  ('Copper Mechanical'),
  ('Cowdrey'),
  ('Devco Mechanical'),
  ('Harris'),
  ('Hydro-Temp Mechanical'),
  ('JH Kelly'),
  ('Mac-Donald Miller'),
  ('McKinstry'),
  ('Shinn'),
  ('Southland Industries'),
  ('Team Mechanical'),
  ('Total Energy Management'),
  ('Vet First');
