import type { BidScope, BidStatus } from '@/hooks/useBids'

/** Badge classes for each bid scope (used on BidCards). */
export const SCOPE_BADGE_CLASSES: Record<BidScope, string> = {
  Ductwork: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  Piping:   'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300',
  Firestop: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300',
  Combo:    'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300',
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
}

/** Badge classes for each bid status (used in Spreadsheet view). */
export const STATUS_BADGE_CLASSES: Record<BidStatus, string> = {
  Unassigned:    'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  Bidding:       'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  'In Progress': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  Sent:          'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
}

/** Text class applied to a bid due date that is critically close (≤ 3 days). */
export const DUE_DATE_URGENT_CLASS = 'text-red-600 font-semibold'

/** Text class applied to a bid due date that is approaching (≤ 7 days). */
export const DUE_DATE_WARNING_CLASS = 'text-yellow-600 font-semibold'
