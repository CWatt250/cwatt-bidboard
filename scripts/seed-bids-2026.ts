/**
 * Seed BidWatt with bids from the 2026 Bid Tracker PDF.
 *
 * Place this file at: scripts/seed-bids-2026.ts
 *
 * Run from project root:
 *   npx tsx --env-file=.env.local scripts/seed-bids-2026.ts
 *
 * Dry run (prints what it would do, no DB writes):
 *   DRY_RUN=1 npx tsx --env-file=.env.local scripts/seed-bids-2026.ts
 *
 * Idempotency:
 *   Bids are matched on (project_name, bid_due_date). Re-runs skip existing rows.
 *   Clients are matched by name. Existing client rows are reused.
 *
 * Skipped from the PDF per spec:
 *   - All "Lost", "No Bid", and "On Hold" statuses
 *   - All Change Order rows (CO Secured / CO Sent / CO Request / CO Submitted)
 *   - All PTO rows
 *   - All Sandler Foundations (training) rows
 *   - Bid prices (you will enter scope-level prices in the app)
 */

import { createAdminClient } from '../lib/supabase/admin'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Default estimator for every seeded bid. Two Colton Watt profiles exist;
// this is the newer real account. The legacy admin profile is
// a05757ba-deca-4207-b146-fabd3452edb7 if you'd rather use that.
const COLTON_ID = '88dd665f-7318-4235-a6fd-9c147c056826'

const DRY_RUN = process.env.DRY_RUN === '1'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Branch = 'PSC' | 'SEA' | 'POR' | 'PHX' | 'SLC'
type Status = 'Unassigned' | 'Bidding' | 'In Progress' | 'Sent' | 'Awarded'

type BidSeed = {
  project_name: string
  branch: Branch
  status: Status
  bid_due_date: string // YYYY-MM-DD
  mike_estimate_number: string | null
  project_location: string | null
  notes: string | null
  clients: string[] // primary + additional bidders parsed from the Notes column
}

// ---------------------------------------------------------------------------
// Bid data
// ---------------------------------------------------------------------------

const BIDS: BidSeed[] = [
  // ---- Dec 2025 ----
  { project_name: 'Home2 Suites / Hampton Inn', branch: 'PSC', status: 'Sent', bid_due_date: '2025-12-09', mike_estimate_number: '180965', project_location: 'Moses Lake, WA', notes: 'Jaime (Bruce)', clients: ['Bruce Mechanical'] },

  // ---- Jan 2026 ----
  { project_name: 'PDX 205', branch: 'PSC', status: 'Sent', bid_due_date: '2026-01-02', mike_estimate_number: '180725', project_location: 'Boardman, OR', notes: 'Derek (McKinstry)', clients: ['McKinstry'] },
  { project_name: 'Warm Springs Modernization', branch: 'PSC', status: 'Awarded', bid_due_date: '2026-01-02', mike_estimate_number: null, project_location: 'Warm Springs, OR', notes: null, clients: ['Devco Mechanical'] },
  { project_name: 'Tacoma Police Headquarters HVAC', branch: 'SEA', status: 'Sent', bid_due_date: '2026-01-06', mike_estimate_number: '180993', project_location: 'Tacoma, WA', notes: 'Zachery Silverson (Copper)', clients: ['Copper Mechanical'] },
  { project_name: 'SmokeTree Resort', branch: 'PHX', status: 'Sent', bid_due_date: '2026-01-07', mike_estimate_number: '181019', project_location: 'Paradise Valley, AZ', notes: 'Rebecca Seals (Cerris)', clients: ['Cerris'] },
  { project_name: 'PDX 154', branch: 'PSC', status: 'Sent', bid_due_date: '2026-01-08', mike_estimate_number: '180879.01', project_location: 'Boardman, OR', notes: 'Bill Banko (Apollo)', clients: ['Apollo Mechanical'] },
  { project_name: 'Chemeketa CC Building 7 Renovation', branch: 'POR', status: 'Sent', bid_due_date: '2026-01-09', mike_estimate_number: '181048', project_location: 'Salem, OR', notes: 'Dylan Duckworth (HTM)', clients: ['Hydro-Temp Mechanical'] },
  { project_name: 'The Whitney', branch: 'PHX', status: 'Sent', bid_due_date: '2026-01-13', mike_estimate_number: '180247.01', project_location: 'Phoenix, AZ', notes: null, clients: ['Crawford Mechanical'] },
  { project_name: 'NWN The Dalles RC Office DCW', branch: 'PSC', status: 'Sent', bid_due_date: '2026-01-14', mike_estimate_number: '180831.02', project_location: 'The Dalles, OR', notes: null, clients: [] },
  { project_name: 'Wilson Creek PH-II Modernization', branch: 'PSC', status: 'Sent', bid_due_date: '2026-01-15', mike_estimate_number: '181063', project_location: 'Wilson Creek, WA', notes: null, clients: [] },
  { project_name: 'Creston SD Energy Upgrades Rebid', branch: 'PSC', status: 'Sent', bid_due_date: '2026-01-16', mike_estimate_number: '180977.01', project_location: 'Creston, WA', notes: null, clients: ['Apollo Mechanical'] },
  { project_name: 'One Community Health - Hood River', branch: 'PSC', status: 'Sent', bid_due_date: '2026-01-16', mike_estimate_number: '181073', project_location: 'Hood River, OR', notes: null, clients: [] },
  { project_name: 'Jacksons Food - Kennewick', branch: 'PSC', status: 'Sent', bid_due_date: '2026-01-20', mike_estimate_number: '181074', project_location: 'Kennewick, WA', notes: null, clients: [] },
  { project_name: 'Jacksons - Spokane', branch: 'PSC', status: 'Sent', bid_due_date: '2026-01-20', mike_estimate_number: '181076', project_location: 'Spokane, WA', notes: null, clients: [] },
  { project_name: 'Moon Café', branch: 'PSC', status: 'Sent', bid_due_date: '2026-01-20', mike_estimate_number: '181078', project_location: 'Kennewick, WA', notes: null, clients: [] },
  { project_name: 'Winco - Walla Walla', branch: 'PSC', status: 'Sent', bid_due_date: '2026-01-20', mike_estimate_number: '181081', project_location: 'Walla Walla, WA', notes: 'BNB, Alden, Bruce, CRP, TEM', clients: ['Total Energy Management', 'BNB Mechanical', 'Alden Mechanical', 'Bruce Mechanical', 'Columbia River Plumbing'] },
  { project_name: 'Whittier ES Budget', branch: 'SEA', status: 'Sent', bid_due_date: '2026-01-21', mike_estimate_number: '181066', project_location: 'Fircrest, WA', notes: null, clients: ['Betschart'] },
  { project_name: 'PDX 188 Liquid Cooling Piping', branch: 'PSC', status: 'Sent', bid_due_date: '2026-01-21', mike_estimate_number: '180923.01', project_location: 'Boardman, OR', notes: null, clients: ['Apollo Mechanical'] },
  { project_name: 'Comfort Suites', branch: 'PSC', status: 'Sent', bid_due_date: '2026-01-21', mike_estimate_number: '181080', project_location: 'Quincy, WA', notes: null, clients: [] },
  { project_name: 'Wilber SD Rebid', branch: 'PSC', status: 'Sent', bid_due_date: '2026-01-21', mike_estimate_number: '180946.01', project_location: 'Wilbur, WA', notes: null, clients: ['Apollo Mechanical'] },
  { project_name: 'Avista Stadium Concessions', branch: 'PSC', status: 'Sent', bid_due_date: '2026-01-22', mike_estimate_number: '181102', project_location: 'Spokane, WA', notes: 'Apollo, Pro-MSI', clients: ['Apollo Mechanical', 'Pro-MSI'] },
  { project_name: 'UO Waste Facility', branch: 'POR', status: 'Awarded', bid_due_date: '2026-01-22', mike_estimate_number: null, project_location: 'Eugene, OR', notes: null, clients: ['Hydro-Temp Mechanical'] },
  { project_name: 'Space X TI', branch: 'SEA', status: 'Sent', bid_due_date: '2026-01-23', mike_estimate_number: '180988.01', project_location: 'Redmond, WA', notes: 'Matthew Marley (Bruce)', clients: ['Bruce Mechanical'] },
  { project_name: 'WAFD Bank - Walla Walla', branch: 'PSC', status: 'Sent', bid_due_date: '2026-01-26', mike_estimate_number: '181113', project_location: 'Walla Walla, WA', notes: null, clients: [] },
  { project_name: 'Consumer Electric - Kennewick', branch: 'PSC', status: 'Sent', bid_due_date: '2026-01-26', mike_estimate_number: '181114', project_location: 'Kennewick, WA', notes: null, clients: [] },
  { project_name: 'Puri-T Welding & Fabrication - Richland', branch: 'PSC', status: 'Sent', bid_due_date: '2026-01-28', mike_estimate_number: '181123', project_location: 'Richland, WA', notes: null, clients: [] },
  { project_name: 'Fire Station #5 Addition & Renovation', branch: 'PSC', status: 'Sent', bid_due_date: '2026-01-28', mike_estimate_number: '181124', project_location: 'Parker, WA', notes: null, clients: [] },
  { project_name: 'Hoodland Fire Station 74', branch: 'POR', status: 'Sent', bid_due_date: '2026-01-29', mike_estimate_number: '181129', project_location: 'Welches, OR', notes: null, clients: [] },
  { project_name: 'Slim Chickens', branch: 'PSC', status: 'Awarded', bid_due_date: '2026-01-29', mike_estimate_number: '181128', project_location: 'Pasco, WA', notes: null, clients: ['Solstice Heating & Air'] },
  { project_name: 'Sierra - Kennewick', branch: 'PSC', status: 'Sent', bid_due_date: '2026-01-29', mike_estimate_number: '181129', project_location: 'Kennewick, WA', notes: null, clients: [] },
  { project_name: 'Union Gap School Addition', branch: 'PSC', status: 'Sent', bid_due_date: '2026-01-29', mike_estimate_number: '181126', project_location: 'Union Gap, WA', notes: null, clients: [] },
  { project_name: 'PSE Tank - Goldendale', branch: 'PSC', status: 'Awarded', bid_due_date: '2026-01-30', mike_estimate_number: '181134', project_location: 'Goldendale, WA', notes: null, clients: ['Coatings Unlimited'] },
  { project_name: 'NWN - Resource Center', branch: 'PSC', status: 'Awarded', bid_due_date: '2026-01-30', mike_estimate_number: null, project_location: 'The Dalles, OR', notes: null, clients: ['Devco Mechanical'] },

  // ---- Feb 2026 ----
  { project_name: 'PDX 070', branch: 'PSC', status: 'Awarded', bid_due_date: '2026-02-03', mike_estimate_number: '181109', project_location: 'Boardman, OR', notes: 'Derek (McKinstry), Bill (Apollo)', clients: ['McKinstry', 'Apollo Mechanical'] },
  { project_name: 'Danebo ES Addition', branch: 'POR', status: 'Sent', bid_due_date: '2026-02-03', mike_estimate_number: '181141', project_location: 'Eugene, OR', notes: 'Dylan Duckworth (HTM)', clients: ['Hydro-Temp Mechanical'] },
  { project_name: 'Lincoln City Welcome Center', branch: 'POR', status: 'Sent', bid_due_date: '2026-02-04', mike_estimate_number: null, project_location: null, notes: 'Hailey (Columbia Allied)', clients: ['Columbia Allied Services'] },
  { project_name: 'MultCo Crisis Stabilization Center', branch: 'POR', status: 'Bidding', bid_due_date: '2026-02-04', mike_estimate_number: '180837.01', project_location: null, notes: 'Dylan Duckworth (HTM)', clients: ['Hydro-Temp Mechanical'] },
  { project_name: 'Affinity at Wenatchee', branch: 'PSC', status: 'Sent', bid_due_date: '2026-02-05', mike_estimate_number: '181146', project_location: null, notes: 'Craig (TEM), Jaime (Bruce), Stuart (Alden)', clients: ['Total Energy Management', 'Bruce Mechanical', 'Alden Mechanical'] },
  { project_name: 'Seattle Center CUP Cooling Tower', branch: 'SEA', status: 'Sent', bid_due_date: '2026-02-10', mike_estimate_number: '181158', project_location: null, notes: 'Heather Darst (Shinn)', clients: ['Shinn'] },
  { project_name: 'LCSC WITT & MTB System Upgrades', branch: 'PSC', status: 'Sent', bid_due_date: '2026-02-10', mike_estimate_number: '181149', project_location: 'Lewiston, ID', notes: null, clients: ['RM Mechanical'] },
  { project_name: 'Everest Park Duct Wrap', branch: 'SEA', status: 'Sent', bid_due_date: '2026-02-10', mike_estimate_number: '181160', project_location: null, notes: null, clients: ['Columbia Allied Services'] },
  { project_name: 'Spokane Tribal Diesel Tank', branch: 'PSC', status: 'Sent', bid_due_date: '2026-02-10', mike_estimate_number: '181162', project_location: null, notes: 'Stuart (Alden)', clients: ['Alden Mechanical'] },
  { project_name: 'Concourse C Baggage Ops Job Start', branch: 'SEA', status: 'Sent', bid_due_date: '2026-02-12', mike_estimate_number: null, project_location: null, notes: null, clients: [] },
  { project_name: "Denny's - Wenatchee", branch: 'PSC', status: 'Sent', bid_due_date: '2026-02-13', mike_estimate_number: '181175', project_location: 'Wenatchee, WA', notes: 'Rich Garrett (Grassi)', clients: ['Grassi Services'] },
  { project_name: "O'Reilly Parts Moses Lake", branch: 'PSC', status: 'Sent', bid_due_date: '2026-02-13', mike_estimate_number: '181173', project_location: 'Moses Lake, WA', notes: 'Rob (Bruce), Darren (CRP)', clients: ['Bruce Mechanical', 'Columbia River Plumbing'] },
  { project_name: 'CVS Pharmacy', branch: 'PSC', status: 'Sent', bid_due_date: '2026-02-18', mike_estimate_number: '181184', project_location: 'Union Gap, WA', notes: 'Craig (TEM)', clients: ['Total Energy Management'] },
  { project_name: 'East Wenatchee 1st Street Apartments', branch: 'PSC', status: 'Sent', bid_due_date: '2026-02-19', mike_estimate_number: '181185', project_location: 'Wenatchee, WA', notes: 'Dillon Farley (Alden)', clients: ['Alden Mechanical'] },
  // TODO: "Trident, Murray" in PHX 83 notes — unmapped. Currently dropped from clients.
  { project_name: 'PHX 83', branch: 'PHX', status: 'Sent', bid_due_date: '2026-02-20', mike_estimate_number: '181164', project_location: 'El Mirage, AZ', notes: 'Trident, Murray', clients: ['Harder'] },
  { project_name: 'Kitsap Fire & Rescue', branch: 'SEA', status: 'Sent', bid_due_date: '2026-02-24', mike_estimate_number: '181194', project_location: 'Bremerton, WA', notes: 'Niina Lipe (Westwood)', clients: ['Westwood Company'] },
  { project_name: 'Woodspring Suites - Boardman', branch: 'PSC', status: 'Sent', bid_due_date: '2026-02-24', mike_estimate_number: '180857', project_location: 'Boardman, OR', notes: 'Nick Mohr (Apollo)', clients: ['Apollo Mechanical'] },
  { project_name: 'PHX 066 final', branch: 'PHX', status: 'Awarded', bid_due_date: '2026-02-24', mike_estimate_number: '180494', project_location: 'Mesa, AZ', notes: 'Cole Snider (Apollo)', clients: ['Apollo Mechanical'] },
  { project_name: 'Obsidian Middle School', branch: 'POR', status: 'Sent', bid_due_date: '2026-02-24', mike_estimate_number: '181193', project_location: 'Redmond, OR', notes: 'Stuart (Alden)', clients: ['Alden Mechanical'] },
  { project_name: 'Sun Lakes Dry Falls Visitor Center', branch: 'PSC', status: 'Sent', bid_due_date: '2026-02-24', mike_estimate_number: '181198', project_location: 'Coulee City, WA', notes: 'Hailey (Columbia Allied), Stuart (Alden)', clients: ['Columbia Allied Services', 'Alden Mechanical'] },
  { project_name: 'Benton County Transitional Housing', branch: 'PSC', status: 'Sent', bid_due_date: '2026-02-26', mike_estimate_number: '181215', project_location: 'Kennewick, WA', notes: 'Craig (TEM)', clients: ['Total Energy Management'] },
  { project_name: 'DPW Maintenance Bldgs', branch: 'PSC', status: 'Sent', bid_due_date: '2026-02-26', mike_estimate_number: '181213', project_location: 'Orofino, ID', notes: 'Stuart (Alden)', clients: ['Alden Mechanical'] },
  { project_name: 'AutoZone - Yakima', branch: 'PSC', status: 'Sent', bid_due_date: '2026-02-27', mike_estimate_number: '181220', project_location: 'Yakima, WA', notes: 'Rob (Bruce), Darren (CRP), Craig (TEM)', clients: ['Bruce Mechanical', 'Columbia River Plumbing', 'Total Energy Management'] },

  // ---- Mar 2026 ----
  { project_name: 'Olympic Behavioral Health', branch: 'SEA', status: 'Sent', bid_due_date: '2026-03-02', mike_estimate_number: '181204', project_location: 'Tukwila, WA', notes: 'Rickey Martin (Apollo), Doug (Holmberg)', clients: ['Apollo Mechanical', 'Holmberg'] },
  { project_name: 'PDX 154 BAFO', branch: 'PSC', status: 'Sent', bid_due_date: '2026-03-02', mike_estimate_number: '180879.01', project_location: 'Boardman, OR', notes: 'Bill Banko (Apollo), Ian LaSalle (MacMiller)', clients: ['Apollo Mechanical', 'Mac-Donald Miller'] },
  { project_name: 'PHX 73', branch: 'PHX', status: 'Sent', bid_due_date: '2026-03-04', mike_estimate_number: '181210', project_location: 'Goodyear, AZ', notes: null, clients: ['Harder'] },
  { project_name: 'Edmond Street Apartments', branch: 'PSC', status: 'Sent', bid_due_date: '2026-03-04', mike_estimate_number: '181231', project_location: 'Nespelem, WA', notes: 'Dillon Farley (Alden), Jaime (Bruce)', clients: ['Alden Mechanical', 'Bruce Mechanical'] },
  { project_name: 'Lifepoint/PeaceHealth Vancouver Rehab Hospital', branch: 'POR', status: 'Sent', bid_due_date: '2026-03-05', mike_estimate_number: '181222', project_location: 'Vancouver, WA', notes: 'Katrina (JH Kelly)', clients: ['JH Kelly'] },
  { project_name: 'Brewster School', branch: 'PSC', status: 'Unassigned', bid_due_date: '2026-03-05', mike_estimate_number: null, project_location: 'Brewster, WA', notes: 'Hailey (CAS)', clients: ['Columbia Allied Services'] },
  { project_name: 'Home2 Suites / Hampton Inn Updated Pricing', branch: 'PSC', status: 'Sent', bid_due_date: '2026-03-05', mike_estimate_number: '180965', project_location: 'Moses Lake, WA', notes: 'Jaime (Bruce)', clients: ['Bruce Mechanical'] },
  { project_name: 'Hoodland Fire Station 74 (HTM)', branch: 'POR', status: 'Sent', bid_due_date: '2026-03-05', mike_estimate_number: '181130', project_location: null, notes: null, clients: ['Hydro-Temp Mechanical'] },
  { project_name: 'Livsmart Suites Hilton', branch: 'PSC', status: 'Bidding', bid_due_date: '2026-03-06', mike_estimate_number: null, project_location: null, notes: 'Darren Keller (CRP)', clients: ['Columbia River Plumbing'] },
  { project_name: 'PTI Electrical Building', branch: 'PSC', status: 'Sent', bid_due_date: '2026-03-09', mike_estimate_number: '180928.01', project_location: null, notes: 'Craig (TEM)', clients: ['Total Energy Management'] },
  { project_name: 'UW Bothell LB2', branch: 'SEA', status: 'Sent', bid_due_date: '2026-03-09', mike_estimate_number: '181249', project_location: null, notes: null, clients: ['Columbia Allied Services'] },
  { project_name: 'CVS Kennewick', branch: 'PSC', status: 'Sent', bid_due_date: '2026-03-10', mike_estimate_number: '181253', project_location: 'Kennewick, WA', notes: 'Craig (Total)', clients: ['Columbia River Plumbing', 'Total Energy Management'] },
  { project_name: 'BFT Bus Wash', branch: 'PSC', status: 'Sent', bid_due_date: '2026-03-11', mike_estimate_number: '181253', project_location: null, notes: 'Darren Keller (CRP)', clients: ['Columbia River Plumbing'] },
  { project_name: 'Ida B Wells HS', branch: 'POR', status: 'Sent', bid_due_date: '2026-03-12', mike_estimate_number: '180713.02', project_location: 'Portland, OR', notes: 'Bryan (HTM)', clients: ['Hydro-Temp Mechanical'] },
  { project_name: 'CCC Bldg. 7 MEPF', branch: 'POR', status: 'Sent', bid_due_date: '2026-03-12', mike_estimate_number: '181048.01', project_location: 'Salem, OR', notes: 'Dylan Duckworth (HTM)', clients: ['Hydro-Temp Mechanical'] },
  { project_name: 'Danebo ES Addition (rebid)', branch: 'POR', status: 'Sent', bid_due_date: '2026-03-12', mike_estimate_number: '181141', project_location: 'Eugene, OR', notes: null, clients: ['Hydro-Temp Mechanical'] },
  { project_name: 'CGCC AMT', branch: 'PSC', status: 'Bidding', bid_due_date: '2026-03-13', mike_estimate_number: '181252', project_location: 'Dallesport, OR', notes: 'Todd (Devco)', clients: ['Devco Mechanical'] },
  { project_name: 'PDX 150', branch: 'PSC', status: 'Sent', bid_due_date: '2026-03-18', mike_estimate_number: '181263', project_location: null, notes: 'Bill Banko (Apollo)', clients: ['McKinstry', 'Apollo Mechanical'] },
  { project_name: 'VA White City Renovation', branch: 'POR', status: 'Sent', bid_due_date: '2026-03-20', mike_estimate_number: '181276', project_location: 'White City, OR', notes: 'Dillion Farley (Alden)', clients: ['Alden Mechanical'] },
  { project_name: 'Core 3 - Phase 1', branch: 'POR', status: 'Sent', bid_due_date: '2026-03-23', mike_estimate_number: '180884.1', project_location: 'Redmond, OR', notes: 'Joshua Beard (Southland)', clients: ['Southland Industries'] },
  { project_name: 'In Flight Trampoline Park', branch: 'SEA', status: 'Sent', bid_due_date: '2026-03-24', mike_estimate_number: '181279', project_location: null, notes: null, clients: [] },
  { project_name: 'Holcomb ES', branch: 'POR', status: 'Bidding', bid_due_date: '2026-03-27', mike_estimate_number: '181273', project_location: 'Oregon City, OR', notes: 'Bryan (HTM)', clients: ['Hydro-Temp Mechanical'] },

  // ---- Apr 2026 ----
  { project_name: 'QTS DC4/DC5', branch: 'SLC', status: 'Bidding', bid_due_date: '2026-04-01', mike_estimate_number: null, project_location: 'Eagle Mountain, UT', notes: null, clients: [] },
  { project_name: 'EAT 06', branch: 'PSC', status: 'Bidding', bid_due_date: '2026-04-02', mike_estimate_number: '181278', project_location: null, notes: 'Joshua Beard (Southland)', clients: ['Southland Industries'] },
  { project_name: 'Holcomb ES Refer', branch: 'POR', status: 'Sent', bid_due_date: '2026-04-07', mike_estimate_number: null, project_location: 'Oregon City, OR', notes: null, clients: ['Hydro-Temp Mechanical'] },
  { project_name: 'Sammamish HS Toilet TI', branch: 'SEA', status: 'Unassigned', bid_due_date: '2026-04-08', mike_estimate_number: null, project_location: null, notes: null, clients: ['Columbia Allied Services'] },
  { project_name: 'Powder Pure', branch: 'PSC', status: 'Sent', bid_due_date: '2026-04-08', mike_estimate_number: '181324', project_location: null, notes: 'Alex (Devco)', clients: ['Devco Mechanical'] },
  { project_name: 'Selah HS CTE Addition', branch: 'PSC', status: 'Sent', bid_due_date: '2026-04-09', mike_estimate_number: '181327', project_location: 'Selah, WA', notes: 'Ascent, BNB, Bruce, CRP, Raver, TEM', clients: ['Alden Mechanical', 'Ascent Mechanical', 'BNB Mechanical', 'Bruce Mechanical', 'Columbia River Plumbing', 'Raver Mechanical', 'Total Energy Management'] },
  { project_name: 'Express Care Clinic', branch: 'SEA', status: 'Unassigned', bid_due_date: '2026-04-10', mike_estimate_number: null, project_location: null, notes: null, clients: ['Columbia Allied Services'] },
  { project_name: 'McMinnville Water & Light', branch: 'POR', status: 'Unassigned', bid_due_date: '2026-04-10', mike_estimate_number: null, project_location: null, notes: null, clients: [] },
  { project_name: 'TTC Locker Room Addition', branch: 'SEA', status: 'Sent', bid_due_date: '2026-04-10', mike_estimate_number: '181329', project_location: null, notes: 'Bruce, Alden', clients: ['Alden Mechanical', 'Bruce Mechanical'] },
  { project_name: 'Pendleton Fire Station 2', branch: 'PSC', status: 'Sent', bid_due_date: '2026-04-10', mike_estimate_number: '181331', project_location: null, notes: null, clients: [] },
  { project_name: 'Nordstrom Rack', branch: 'PSC', status: 'Sent', bid_due_date: '2026-04-10', mike_estimate_number: '181333', project_location: 'Kennewick, WA', notes: null, clients: ['Dayco Heating & Air'] },
  { project_name: 'Grandview WWTP', branch: 'PSC', status: 'Unassigned', bid_due_date: '2026-04-14', mike_estimate_number: null, project_location: 'Grandview, WA', notes: null, clients: ['Clearwater Construction'] },
  { project_name: 'Ice Fountain Water District Office', branch: 'PSC', status: 'Sent', bid_due_date: '2026-04-14', mike_estimate_number: '181343', project_location: 'Hood River, OR', notes: 'Devco, Alden', clients: ['Westwood Company', 'Devco Mechanical', 'Alden Mechanical'] },
  { project_name: 'ALK Selway', branch: 'PSC', status: 'Sent', bid_due_date: '2026-04-14', mike_estimate_number: '181339', project_location: 'Post Falls, ID', notes: 'Colton Justus (Apollo)', clients: ['Mac-Donald Miller', 'Apollo Mechanical'] },
  { project_name: 'Horizon Court Apartments', branch: 'PSC', status: 'Sent', bid_due_date: '2026-04-15', mike_estimate_number: '181342', project_location: 'Hermiston, OR', notes: 'Nick Mohr (Apollo)', clients: ['Apollo Mechanical'] },
  { project_name: 'Barnes ES Gym/Cafeteria', branch: 'POR', status: 'Sent', bid_due_date: '2026-04-16', mike_estimate_number: '181349', project_location: 'Beaverton, OR', notes: null, clients: ['Hydro-Temp Mechanical'] },
  { project_name: 'SKNN Aesthetics TI', branch: 'PSC', status: 'Sent', bid_due_date: '2026-04-17', mike_estimate_number: '181352', project_location: 'Pasco, WA', notes: null, clients: ['Total Energy Management'] },
  { project_name: 'PDX 189', branch: 'PSC', status: 'Sent', bid_due_date: '2026-04-20', mike_estimate_number: '181340', project_location: 'Boardman, OR', notes: null, clients: ['Apollo Mechanical'] },
  { project_name: 'Stevenson-Carson SD', branch: 'POR', status: 'Sent', bid_due_date: '2026-04-20', mike_estimate_number: '181354', project_location: null, notes: null, clients: ['Total Energy Management'] },
  { project_name: 'EAT 06 (Harris)', branch: 'SEA', status: 'Sent', bid_due_date: '2026-04-21', mike_estimate_number: null, project_location: null, notes: 'Zach Heaston, Bill Banko (Apollo)', clients: ['Harris', 'Apollo Mechanical'] },
  { project_name: 'WSU TFREC', branch: 'PSC', status: 'Sent', bid_due_date: '2026-04-21', mike_estimate_number: '180938.02', project_location: 'Wenatchee, WA', notes: 'Jon Benedict', clients: ['Mac-Donald Miller'] },
  { project_name: 'Danebo ES Refer Piping', branch: 'POR', status: 'Sent', bid_due_date: '2026-04-21', mike_estimate_number: null, project_location: null, notes: null, clients: ['Hydro-Temp Mechanical'] },
  { project_name: 'Yakima Air Terminal', branch: 'PSC', status: 'Sent', bid_due_date: '2026-04-22', mike_estimate_number: '181361', project_location: null, notes: null, clients: ['Bruce Mechanical'] },
  { project_name: 'First Food Processing', branch: 'SEA', status: 'Sent', bid_due_date: '2026-04-22', mike_estimate_number: '181358', project_location: null, notes: null, clients: ['Bruce Mechanical'] },
  { project_name: 'Alama Collective Studio', branch: 'PSC', status: 'Sent', bid_due_date: '2026-04-23', mike_estimate_number: '177809', project_location: null, notes: null, clients: [] },
  { project_name: '5Below', branch: 'PSC', status: 'Sent', bid_due_date: '2026-04-24', mike_estimate_number: '181368', project_location: null, notes: null, clients: [] },
  { project_name: 'Prosser Grease Wrap', branch: 'PSC', status: 'Sent', bid_due_date: '2026-04-27', mike_estimate_number: '181642', project_location: null, notes: null, clients: ['MBI Construction'] },
  { project_name: 'Hilton Dual Brand Hotel', branch: 'PSC', status: 'Bidding', bid_due_date: '2026-04-28', mike_estimate_number: '181647', project_location: null, notes: 'Isaiah Navales (Pro Mechanical)', clients: ['Bruce Mechanical', 'Pro-MSI'] },
  { project_name: 'White Salmon Valley Pool', branch: 'PSC', status: 'Bidding', bid_due_date: '2026-04-29', mike_estimate_number: '181346', project_location: null, notes: 'Columbia Allied, Dillon (Alden)', clients: ['Devco Mechanical', 'Columbia Allied Services', 'Alden Mechanical'] },
  { project_name: 'Trillium Phase 2', branch: 'PSC', status: 'Sent', bid_due_date: '2026-04-29', mike_estimate_number: '181655', project_location: 'Hood River, OR', notes: null, clients: ['Devco Mechanical'] },
  { project_name: 'Lystek - Biosolids Equipment', branch: 'PHX', status: 'Bidding', bid_due_date: '2026-04-30', mike_estimate_number: '181640', project_location: null, notes: 'Reagon Hoofman (Kinley Construction)', clients: ['Kinley Construction'] },

  // ---- May 2026 ----
  { project_name: 'Grant Node Data Center', branch: 'PSC', status: 'Unassigned', bid_due_date: '2026-05-01', mike_estimate_number: null, project_location: null, notes: 'Makala Hart (Holmberg)', clients: ['Holmberg'] },
  { project_name: 'Valvoline Instant Oil Change', branch: 'PSC', status: 'Bidding', bid_due_date: '2026-05-01', mike_estimate_number: null, project_location: 'Richland, WA', notes: null, clients: ['Bruce Mechanical'] },
]

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log(`BidWatt seed — 2026 Bid Tracker import`)
  console.log(`Bids to import: ${BIDS.length}`)
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`)
  console.log('')

  const supabase = createAdminClient()

  // 1. Collect every unique client name we'll need.
  const allClientNames = Array.from(
    new Set(BIDS.flatMap((b) => b.clients))
  ).sort()
  console.log(`Unique client names: ${allClientNames.length}`)

  // 2. Look up which already exist.
  const { data: existingClients, error: clientsErr } = await supabase
    .from('clients')
    .select('id, name')
  if (clientsErr) throw clientsErr

  const clientByName = new Map<string, string>(
    (existingClients ?? []).map((c) => [c.name, c.id])
  )
  const missingClientNames = allClientNames.filter(
    (n) => !clientByName.has(n)
  )

  console.log(`  existing: ${allClientNames.length - missingClientNames.length}`)
  console.log(`  to create: ${missingClientNames.length}`)
  if (missingClientNames.length > 0) {
    console.log('  new clients:')
    missingClientNames.forEach((n) => console.log(`    - ${n}`))
  }

  // 3. Insert missing clients.
  if (missingClientNames.length > 0 && !DRY_RUN) {
    const { data: newClients, error } = await supabase
      .from('clients')
      .insert(missingClientNames.map((name) => ({ name })))
      .select('id, name')
    if (error) throw error
    newClients?.forEach((c) => clientByName.set(c.name, c.id))
    console.log(`Created ${newClients?.length ?? 0} new clients`)
  }

  // 4. Insert bids (idempotent on project_name + bid_due_date).
  let inserted = 0
  let skipped = 0
  let failed = 0

  for (const bid of BIDS) {
    // Idempotency check.
    const { data: existing } = await supabase
      .from('bids')
      .select('id')
      .eq('project_name', bid.project_name)
      .eq('bid_due_date', bid.bid_due_date)
      .maybeSingle()

    if (existing) {
      skipped++
      console.log(`  skip (exists): ${bid.project_name} @ ${bid.bid_due_date}`)
      continue
    }

    if (DRY_RUN) {
      inserted++
      console.log(`  would insert: ${bid.project_name} @ ${bid.bid_due_date} [${bid.status}, ${bid.branch}] clients=${bid.clients.length}`)
      continue
    }

    // Insert the bid.
    const { data: newBid, error: bidErr } = await supabase
      .from('bids')
      .insert({
        project_name: bid.project_name,
        branch: bid.branch,
        status: bid.status,
        bid_due_date: bid.bid_due_date,
        mike_estimate_number: bid.mike_estimate_number,
        project_location: bid.project_location,
        notes: bid.notes,
        estimator_id: COLTON_ID,
      })
      .select('id')
      .single()

    if (bidErr || !newBid) {
      failed++
      console.error(`  FAIL: ${bid.project_name}`, bidErr)
      continue
    }

    // Insert bid_clients (dedupe by name in case the same client appears twice).
    const uniqueClientNames = Array.from(new Set(bid.clients))
    if (uniqueClientNames.length > 0) {
      const bidClientRows = uniqueClientNames.map((name) => ({
        bid_id: newBid.id,
        client_id: clientByName.get(name) ?? null,
        client_name: name,
      }))
      const { error: bcErr } = await supabase
        .from('bid_clients')
        .insert(bidClientRows)
      if (bcErr) {
        console.error(
          `  WARN (bid created but bid_clients failed): ${bid.project_name}`,
          bcErr
        )
      }
    }

    inserted++
    console.log(`  + ${bid.project_name} @ ${bid.bid_due_date}`)
  }

  console.log('')
  console.log('Summary')
  console.log(`  inserted: ${inserted}`)
  console.log(`  skipped (already exist): ${skipped}`)
  console.log(`  failed: ${failed}`)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
