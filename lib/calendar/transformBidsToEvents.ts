import type { Bid } from '@/hooks/useBids'

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  resource: Bid
}

export default function transformBidsToEvents(bids: Bid[]): CalendarEvent[] {
  return bids
    .filter((bid) => bid.bid_due_date)
    .map((bid) => {
      const date = new Date(bid.bid_due_date)
      // Treat date string as local midnight to avoid UTC offset shifts
      const local = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
      return {
        id: bid.id,
        title: `${bid.project_name} — ${bid.client}`,
        start: local,
        end: local,
        resource: bid,
      }
    })
}
