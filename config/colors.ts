import type { BidScope, BidStatus } from '@/hooks/useBids'

/** Badge classes for each bid scope (used on BidCards). */
export const SCOPE_BADGE_CLASSES: Record<BidScope, string> = {
  'Plumbing Piping': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  'HVAC Piping':     'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300',
  'Refer Piping':    'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300',
  'HVAC Ductwork':   'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300',
  'Fire Stopping':   'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300',
  'Equipment':       'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300',
  'Other':           'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
}

/** Short industry abbreviations for each bid scope (used on compact cards). */
export const SCOPE_ABBREVIATIONS: Record<BidScope, string> = {
  'Plumbing Piping': 'PLMB',
  'HVAC Piping':     'MECH',
  'HVAC Ductwork':   'DUCT',
  'Fire Stopping':   'FS',
  'Refer Piping':    'REF',
  'Equipment':       'EQ',
  'Other':           'OTHR',
}

/** Header and body background classes for each Kanban column. */
export const STATUS_COLUMN_STYLES: Record<BidStatus, { header: string; bg: string }> = {
  Unassigned: {
    header: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    bg:     'bg-gray-50 dark:bg-gray-900/30',
  },
  Bidding: {
    header: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    bg:     'bg-blue-50/50 dark:bg-blue-950/20',
  },
  'In Progress': {
    header: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    bg:     'bg-amber-50/50 dark:bg-amber-950/20',
  },
  Sent: {
    header: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    bg:     'bg-green-50/50 dark:bg-green-950/20',
  },
  Verbal: {
    header: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    bg:     'bg-violet-50/50 dark:bg-violet-950/20',
  },
  Awarded: {
    header: 'bg-emerald-200 text-emerald-800 dark:bg-emerald-800/40 dark:text-emerald-200',
    bg:     'bg-emerald-50/60 dark:bg-emerald-950/20',
  },
  Lost: {
    header: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300',
    bg:     'bg-rose-50/40 dark:bg-rose-950/20',
  },
}

/** Badge classes for each bid status (used in Spreadsheet view). */
export const STATUS_BADGE_CLASSES: Record<BidStatus, string> = {
  Unassigned:    'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  Bidding:       'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  'In Progress': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  Sent:          'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  Verbal:        'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800',
  Awarded:       'bg-emerald-200 text-emerald-800 border-emerald-300 dark:bg-emerald-800/40 dark:text-emerald-200 dark:border-emerald-700',
  Lost:          'bg-rose-100 text-rose-600 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
}

/** Text class applied to a bid due date that is critically close (≤ 3 days). */
export const DUE_DATE_URGENT_CLASS = 'text-red-600 font-semibold'

/** Text class applied to a bid due date that is approaching (≤ 7 days). */
export const DUE_DATE_WARNING_CLASS = 'text-yellow-600 font-semibold'

/** Badge classes for each branch. */
export const BRANCH_BADGE_CLASSES: Record<string, string> = {
  PSC: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300',
  SEA: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300',
  POR: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300',
  PHX: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300',
  SLC: 'bg-lime-100 text-lime-700 border-lime-200 dark:bg-lime-900/30 dark:text-lime-300',
}

// ─── Dark theme — Command Center admin dashboard only ──────────────────────
// These coexist with the light exports above; only AdminDashboard.tsx reads
// from them. Kanban / Bid Board / Calendar / Recaps continue to use the
// light sets so the rest of the app's visual language is unchanged.

/** Status accent colors for the dark command-center dashboard. */
export const DARK_STATUS_COLORS: Record<BidStatus, string> = {
  Unassigned: '#7d8aba',
  Bidding: '#3b82f6',
  'In Progress': '#f59e0b',
  Sent: '#10b981',
  Verbal: '#8b5cf6',
  Awarded: '#34d399',
  Lost: '#fb7185',
}

/** Branch accent colors for the dark command-center dashboard. */
export const DARK_BRANCH_COLORS: Record<string, string> = {
  PSC: '#38bdf8',
  SEA: '#2dd4bf',
  POR: '#a78bfa',
  PHX: '#fb923c',
  SLC: '#a3e635',
}

/** Scope accent colors (Recharts / donut segments). Shared by light and dark. */
export const SCOPE_CHART_COLORS: Record<string, string> = {
  'HVAC Piping':     '#378ADD',
  'Refer Piping':    '#6366f1',
  'HVAC Ductwork':   '#60a5fa',
  'Plumbing Piping': '#639922',
  'Fire Stopping':   '#f59e0b',
  'Equipment':       '#a855f7',
  'Other':           '#9ca3af',
}
