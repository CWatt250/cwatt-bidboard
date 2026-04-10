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
  created_at: string
  updated_at: string
}

export type BidStatus = 'Unassigned' | 'Bidding' | 'In Progress' | 'Sent' | 'Awarded' | 'Lost'
export type BidScope = 'Plumbing Piping' | 'HVAC Piping' | 'HVAC Ductwork' | 'Fire Stopping' | 'Equipment' | 'Other'
export type BidBranch = Branch

export interface BidLineItem {
  id: string
  bid_id: string
  client: string | null
  scope: BidScope
  price: number | null
  created_at: string
  updated_at: string
}

export interface BidClient {
  id: string
  bid_id: string
  client_name: string
  created_at: string
}

export interface Bid {
  id: string
  project_name: string
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
