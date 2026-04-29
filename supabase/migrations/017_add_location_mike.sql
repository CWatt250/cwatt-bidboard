-- 017_add_location_mike.sql
-- Adds optional project_location and mike_estimate_number columns to bids.

ALTER TABLE bids ADD COLUMN project_location text;
ALTER TABLE bids ADD COLUMN mike_estimate_number text;
