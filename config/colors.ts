import type { BidScope, BidStatus } from '@/hooks/useBids'

/** Badge classes for each bid scope (used on BidCards). */
export const SCOPE_BADGE_CLASSES: Record<BidScope, string> = {
  'Plumbing Piping': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  'HVAC Piping':     'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300',
  'HVAC Ductwork':   'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300',
  'Fire Stopping':   'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300',
  'Equipment':       'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300',
  'Other':           'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
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
  Awarded:       'bg-emerald-200 text-emerald-800 border-emerald-300 dark:bg-emerald-800/40 dark:text-emerald-200 dark:border-emerald-700',
  Lost:          'bg-rose-100 text-rose-600 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
}

/** Text class applied to a bid due date that is critically close (≤ 3 days). */
export const DUE_DATE_URGENT_CLASS = 'text-red-600 font-semibold'

/** Text class applied to a bid due date that is approaching (≤ 7 days). */
export const DUE_DATE_WARNING_CLASS = 'text-yellow-600 font-semibold'
