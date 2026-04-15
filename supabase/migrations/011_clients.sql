-- Create clients table
CREATE TABLE clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create client_contacts table
CREATE TABLE client_contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  title text,
  created_at timestamptz DEFAULT now()
);

-- Migrate existing unique client names from bid_clients into clients table
INSERT INTO clients (name)
SELECT DISTINCT client_name
FROM bid_clients
WHERE client_name IS NOT NULL AND client_name != '';

-- Add client_id column to bid_clients
ALTER TABLE bid_clients ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

-- Populate client_id from matched names
UPDATE bid_clients bc
SET client_id = c.id
FROM clients c
WHERE bc.client_name = c.name;

-- RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view clients"
ON clients FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert clients"
ON clients FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update clients"
ON clients FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view contacts"
ON client_contacts FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage contacts"
ON client_contacts FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update contacts"
ON client_contacts FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete contacts"
ON client_contacts FOR DELETE USING (auth.role() = 'authenticated');
