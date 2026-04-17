-- 015_jurisdiction_map.sql
-- Tables and seed data for the HFIAW Jurisdiction Map Tool

-- =============================================================
-- TABLES
-- =============================================================

-- Locals (union halls)
create table locals (
  id            integer primary key,
  name          text not null,
  color         text not null,
  hall_city     text,
  address       text,
  phone         text,
  bm            text,
  cba_label     text,
  jurisdiction  text,
  sub_note      text,
  map_center    jsonb,
  map_zoom      integer,
  active        boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Dispatch points (cities where workers dispatch from)
create table dispatch_points (
  id         uuid primary key default gen_random_uuid(),
  local_id   integer references locals(id) on delete cascade,
  name       text not null,
  lat        numeric not null,
  lng        numeric not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Zone rates (travel pay zones)
create table zone_rates (
  id              uuid primary key default gen_random_uuid(),
  local_id        integer references locals(id) on delete cascade,
  zone_label      text not null,
  min_miles       integer not null,
  max_miles       integer,
  personal_rate   numeric,
  company_rate    numeric,
  rate_note       text,
  is_free         boolean default false,
  is_subsistence  boolean default false,
  is_appendix_a   boolean default false,
  sort_order      integer default 0,
  created_at      timestamptz default now()
);

-- Appendix A counties (Local 7 central WA)
create table appendix_a_counties (
  fips text primary key
);

-- =============================================================
-- SEED DATA
-- =============================================================

-- Locals
INSERT INTO locals (id, name, color, hall_city, address, phone, bm, cba_label, jurisdiction, sub_note, map_center, map_zoom) VALUES
(82, 'Local 82', '#4a9eff', 'Spokane, WA', '4002 E Broadway Ave, Spokane, WA 99202', '(509) 534-1590', 'Rory Homes, Business Manager', 'CBA 8/1/2023–7/31/2027 · Rates effective 8/1/2025', 'Eastern Washington (19 counties east of Cascade crest), Northern Idaho (10 counties north of the Salmon River), and all of Montana (56 counties).', 'Zones measured from employee''s declared residence city hall. Coeur d''Alene, ID is free zone for Spokane residents. Mileage: $0.66/mi (IRS rate), max $400 beginning/end of job.', '{"lat":47.0,"lng":-112.0}', 5),
(7, 'Local 7', '#3dd68c', 'Tukwila, WA', '14675 Interurban Ave S, Ste. 103, Tukwila, WA 98168', '(206) 812-0777', 'Todd Mitchell, Business Manager', 'CBA 6/1/2024–5/31/2030 · Rates effective 6/1/2024', 'Western Washington: Chelan, Clallam, Douglas, Grays Harbor, Island, Jefferson, King, Kitsap, Kittitas, Lewis, Mason, Okanogan, Pacific, Pierce, San Juan, Skagit, Snohomish, Thurston, Whatcom, and Yakima counties.', 'Residency free zone: resident 30+ days within 40 mi of jobsite. Port Townsend and Sequim: employer provides lodging (no travel pay).', '{"lat":47.6,"lng":-122.3}', 7),
(36, 'Local 36', '#f5a623', 'Portland, OR', 'Verify address with hall', 'Verify phone with hall', 'Verify with hall', 'Rates effective 3/30/2025', 'Oregon statewide and SW Washington: Wahkiakum, Cowlitz, Clark, Skamania, and Klickitat counties.', 'Zones from Portland, Medford, or Hermiston city hall. Zone 5: $160/day overnight or $90/day drive-only. 30-mi residency free zone in Zone 5 and from Medford/Eugene/Hermiston. Coastal resort towns in Zone 3 get Zone 5 rate. 6 scheduled days in Zones 4–5 = 7 days per diem. †Co. vehicle rates from 3/30/25 CBA — verify current.', '{"lat":44.0,"lng":-121.5}', 6);

-- Dispatch Points
INSERT INTO dispatch_points (local_id, name, lat, lng, sort_order) VALUES
(82, 'Spokane, WA', 47.6588, -117.4260, 0),
(82, 'Pasco, WA', 46.2396, -119.1006, 1),
(7, 'Seattle', 47.6062, -122.3321, 0),
(7, 'Tacoma', 47.2529, -122.4443, 1),
(36, 'Portland, OR', 45.5051, -122.6750, 0),
(36, 'Medford, OR', 42.3265, -122.8756, 1),
(36, 'Hermiston, OR', 45.8401, -119.2895, 2);

-- Zone Rates: Local 82
INSERT INTO zone_rates (local_id, zone_label, min_miles, max_miles, personal_rate, is_free, is_subsistence, rate_note, sort_order) VALUES
(82, 'Zone 1–2', 0, 30, 0, true, false, null, 0),
(82, 'Zone 3', 31, 40, 30, false, false, null, 1),
(82, 'Zone 4', 41, 50, 40, false, false, null, 2),
(82, 'Zone 5', 51, 60, 55, false, false, null, 3),
(82, 'Zone 6', 61, 70, 65, false, false, null, 4),
(82, 'Zone 6+', 71, null, 140, false, true, 'Includes $35/day meals', 5);

-- Zone Rates: Local 7 (standard)
INSERT INTO zone_rates (local_id, zone_label, min_miles, max_miles, personal_rate, is_free, is_subsistence, rate_note, sort_order) VALUES
(7, 'Free Zone', 0, 20, 0, true, false, null, 0),
(7, 'Mileage Zone', 21, 70, null, false, false, '$0.67/mi × (miles-20) × 2 round-trip', 1),
(7, 'Per Diem Zone', 71, null, 150, false, true, '$150/day — all workers regardless of transport', 2);

-- Zone Rates: Local 7 Appendix A (central WA)
INSERT INTO zone_rates (local_id, zone_label, min_miles, max_miles, personal_rate, is_free, is_appendix_a, sort_order) VALUES
(7, 'Zone 1', 0, 20, 0, true, true, 10),
(7, 'Zone 2', 21, 30, 20, false, true, 11),
(7, 'Zone 3', 31, 40, 30, false, true, 12),
(7, 'Zone 4', 41, 50, 40, false, true, 13),
(7, 'Zone 5', 51, 60, 50, false, true, 14),
(7, 'Zone 6', 61, 70, 60, false, true, 15),
(7, 'Zone 7', 71, null, 150, false, true, 16);

-- Zone Rates: Local 36
INSERT INTO zone_rates (local_id, zone_label, min_miles, max_miles, personal_rate, company_rate, is_free, is_subsistence, rate_note, sort_order) VALUES
(36, 'Zone 1', 0, 30, 0, 0, true, false, null, 0),
(36, 'Zone 2', 31, 50, 30, 19, false, false, null, 1),
(36, 'Zone 3', 51, 70, 65, 29, false, false, null, 2),
(36, 'Zone 4', 71, 100, 85, 43, false, false, null, 3),
(36, 'Zone 5', 101, null, 160, 135, false, true, '$160/day overnight or $90/day drive-only (personal); $135/day overnight or $75/day drive-only (co. vehicle)', 4);

-- Appendix A Counties (Local 7 central WA: Chelan, Douglas, Kittitas, Okanogan, Yakima)
INSERT INTO appendix_a_counties (fips) VALUES
('53007'),  -- Chelan
('53017'),  -- Douglas
('53037'),  -- Kittitas
('53047'),  -- Okanogan
('53077');  -- Yakima

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

ALTER TABLE locals ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE appendix_a_counties ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users
CREATE POLICY "Authenticated users can read locals" ON locals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read dispatch_points" ON dispatch_points FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read zone_rates" ON zone_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read appendix_a_counties" ON appendix_a_counties FOR SELECT TO authenticated USING (true);

-- INSERT: admin only
CREATE POLICY "Admins can insert locals" ON locals FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can insert dispatch_points" ON dispatch_points FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can insert zone_rates" ON zone_rates FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can insert appendix_a_counties" ON appendix_a_counties FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- UPDATE: admin only
CREATE POLICY "Admins can update locals" ON locals FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can update dispatch_points" ON dispatch_points FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can update zone_rates" ON zone_rates FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can update appendix_a_counties" ON appendix_a_counties FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- DELETE: admin only
CREATE POLICY "Admins can delete locals" ON locals FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can delete dispatch_points" ON dispatch_points FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can delete zone_rates" ON zone_rates FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Admins can delete appendix_a_counties" ON appendix_a_counties FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
