---
name: project-conventions
description: Non-obvious BidWatt invariants that must never be violated. Auto-load whenever editing bids, scopes, clients, dashboard pages, admin API routes, or UI components. Covers Bid Price calculation, the multi-client junction-table model, the dashboard read-only rule, the design system, and the RBAC boundary.
user-invocable: false
---

# BidWatt Project Conventions

This skill encodes invariants that are easy to violate accidentally. Apply them silently whenever the relevant code is in scope.

## Bid Price calculation

Bid Price on a bid is **always** computed from the sum of its scope line items (`bid_line_items.price` summed per bid). It is **never** manually editable. Any UI element that suggests directly editing Bid Price is wrong — only individual scope prices are editable, and the total must auto-recalculate.

If you see code or a UI field that allows direct Bid Price input, flag it as a bug.

## Multi-client bids via junction table

Bids associate with clients **only** through the `bid_clients` junction table. There is no `client_id` column on `bids`. When querying client info for a bid, join through `bid_clients`. When mutating client associations, insert or delete junction rows — never set a foreign key on `bids`.

A bid can have multiple clients. The UI surface for this is the ClientsPopover component.

## Dashboard is read-only

The `/dashboard` page (the landing page after login) is read-only. No buttons that mutate state, no inline editing, no quick-add controls. All mutations happen in `/dashboard/kanban`, `/dashboard/bids/[id]`, or the workspace pages.

If a feature request implies adding a mutation to the dashboard, propose adding it to the appropriate detail page instead and ask the user to confirm.

## UI/UX design system

CLAUDE.md mandates following the design system on every UI task. Specifically:

- Light theme only — no `dark:` Tailwind variants, no theme toggle
- Borders are `0.5px` — use `border-[0.5px]`, never bare `border` or `border-1`
- No gradients anywhere — no `bg-gradient-*`, no inline gradient styles
- Typography sizes come from the existing scale — don't introduce new one-off sizes
- shadcn/ui components are the base; Tailwind v4 utility classes only
- Lucide icons only — no emoji-as-icon, no other icon libraries

## RBAC boundary

All routes under `app/api/admin/` enforce role-based permissions backed by RLS policies (migration `006_rls_role_policies`). The role model is Estimator / Branch Manager / Admin.

- Never relax an RBAC check to make a feature work
- Never expose `SUPABASE_SERVICE_ROLE_KEY` client-side — it stays in API routes and server components only
- New admin endpoints MUST replicate the existing role-check pattern from a neighboring route in `app/api/admin/`
- The dashboard server layout must check `profile.is_active` and sign out + redirect if false

If unsure whether a new endpoint needs RBAC, the answer is yes.

## Realtime conventions

Supabase realtime subscriptions live in `hooks/useBids.ts` and `hooks/useBid.ts`. Tables that need realtime have:

- `REPLICA IDENTITY FULL` set
- Membership in the `supabase_realtime` publication

Currently in the publication: `bids`, `bid_line_items`, `bid_clients`. If you add a table that needs cross-window live updates, the migration must add it to the publication.
