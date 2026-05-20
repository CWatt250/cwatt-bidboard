export type Branch = 'PSC' | 'SEA' | 'POR' | 'PHX' | 'SLC'

export type UserRole = 'estimator' | 'branch_manager' | 'admin'

export const BRANCH_LABELS: Record<Branch, string> = {
  PSC: 'Pasco, WA',
  SEA: 'Seattle, WA',
  POR: 'Portland, OR',
  PHX: 'Phoenix, AZ',
  SLC: 'Salt Lake City, UT',
}

export interface Profile {
  id: string
  name: string
  role: UserRole
  is_active: boolean
  created_at: string
  // Joined
  branches?: Branch[]
}

export interface UserBranch {
  id: string
  user_id: string
  branch: Branch
  created_at: string
}

export interface WorkspaceTodo {
  id: string
  user_id: string
  text: string
  is_completed: boolean
  completed_at?: string
  /** Set when the task is hidden from the to-do list. The row stays in the DB
   *  (recaps still use it); null means the task is visible in the list. */
  dismissed_from_list_at?: string | null
  created_at: string
  updated_at: string
}

export type BidStatus = 'Unassigned' | 'Bidding' | 'In Progress' | 'Sent' | 'Verbal' | 'Awarded' | 'Lost'
export type BidScope = 'Plumbing Piping' | 'HVAC Piping' | 'Refer Piping' | 'HVAC Ductwork' | 'Fire Stopping' | 'Equipment' | 'Other'
export type BidBranch = Branch

export interface BidLineItem {
  id: string
  bid_id: string
  client: string | null
  scope: BidScope
  price: number | null
  is_awarded: boolean
  awarded_at: string | null
  estimator_id: string | null
  /** Joined from profiles via bid_line_items.estimator_id — null when not overridden */
  estimator_name?: string | null
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface ClientContact {
  id: string
  client_id: string
  name: string
  email: string | null
  phone: string | null
  title: string | null
  created_at: string
}

export interface BidClient {
  id: string
  bid_id: string
  client_id: string | null
  client_name: string | null
  /** Joined from clients table — preferred display name when present */
  clients?: { name: string } | null
  /** Subset of scopes on the parent bid that apply to this client. Drives the per-client total. */
  scopes: string[]
  created_at: string
}

/** Prefer the joined clients.name, falling back to the denormalized client_name. */
export function getBidClientName(c: BidClient): string {
  return c.clients?.name ?? c.client_name ?? ''
}

export interface BidDocument {
  id: string
  bid_id: string
  file_name: string
  file_path: string
  file_size: number | null
  file_type: string | null
  uploaded_by: string | null
  created_at: string
  category: string
}

export type BidChangeOrderStatus = 'Pending' | 'Approved' | 'Rejected'

export interface BidChangeOrder {
  id: string
  bid_id: string
  co_number: string
  co_date: string | null
  description: string | null
  value: number
  status: BidChangeOrderStatus
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface Bid {
  id: string
  project_name: string
  project_location: string | null
  mike_estimate_number: string | null
  branch: Branch
  estimator_id: string | null
  estimator_name: string | null
  status: BidStatus
  bid_due_date: string
  project_start_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined fields
  line_items?: BidLineItem[]
  clients?: BidClient[] // from bid_clients junction table
  total_price?: number // computed: sum of all line item prices
}
