# BidWatt — Claude Code Context

## What is BidWatt
BidWatt is a full-stack bid management web app built for Irex Argus, a mechanical insulation contractor. It helps estimators track, manage, and analyze bids across 5 branches.

## Stack
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Database:** Supabase (PostgreSQL + RLS)
- **UI:** shadcn/ui + Tailwind CSS
- **Deployment:** Vercel (not yet deployed — running locally)
- **Repo:** `CWatt250/cwatt-bidboard`
- **Local path:** `C:\Dev\cwatt-bidboard`

## Branches
| Code | Location |
|------|----------|
| PSC | Pasco, WA (#467) |
| SEA | Seattle, WA (#466) |
| POR | Portland, OR (#465) |
| PHX | Phoenix, AZ (#462) |
| SLC | Salt Lake City, UT (#468) |

## Supabase
- **Project:** BidWatt
- **URL:** `cbntiiixrlxkdxafxivl.supabase.co`
- **Region:** West US Oregon (free tier)
- **Admin account:** wattattack@yahoo.com (UUID: a05757ba-deca-4207-b146-fabd3452edb7, all 5 branches assigned)
- **Env vars needed:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

## Migrations (run in order in Supabase SQL editor)
1. `001_initial_schema`
2. `002_update_scope_enum`
3. `003_bid_line_items` (includes Awarded/Lost)
4. `004_branch_names`
5. `005_roles_and_branches`
6. `006_rls_role_policies`
7. `007_activity_log`
8. `008_bid_notes`
9. `009_bid_clients` (junction table for multi-client support)

## Roles
- **Estimator** — views own bids, kanban, toolbox
- **Branch Manager** — views all bids in their branch, reports
- **Admin** — full access across all branches

## What's Built
- **Dashboard** — KPI row, active pipeline chart, pipeline trend, branch performance, revenue by scope donut, recent bids. Filters: global time range, trend range, branch metric toggle, recent bids status+branch.
- **My Workspace** — KPI row (Due Today/Week, Sent, Total Bid Value), kanban (Unassigned/Bidding/In Progress/Sent/Lost), To-Do List, Recent Activity panel
- **Bid Board** — TanStack Table spreadsheet, inline ghost row (Excel-style), scope pricing popover, multi-client popover, filter bar (Status/Branch/Scope/Due Date), column reorder
- **Calendar** — bid due dates with filters
- **Bid Detail Page** — `/dashboard/bids/[id]`, full bid info, line items, notes, activity log
- **Toolbox** — MIKE Discount, Material Price, Crew Size calculators
- **Admin Panel** — Users tab built, Branches/Permissions/System tabs pending
- **Reports** — Branch Manager + Admin only

## Key Folders
```
app/
  dashboard/
    page.tsx                  — Dashboard
    my-workspace/page.tsx     — My Workspace (kanban)
    bid-board/page.tsx        — Bid Board (spreadsheet) - also at /spreadsheet
    bids/[id]/page.tsx        — Bid detail page
    calendar/page.tsx
    toolbox/page.tsx
    admin/page.tsx
components/
  dashboard/                  — Dashboard charts and cards
  kanban/                     — BidCard, KanbanColumn
  spreadsheet/                — DataTable, GhostRow, ScopePricingPopover, ClientsPopover
  workspace/                  — KpiRow, TodoList, RecentActivity
  ui/                         — shadcn/ui components
```

## UI/UX Rule (CRITICAL)
**Before making ANY design decision or writing ANY UI code, read and follow the UI/UX skill at:**
**https://github.com/nextlevelbuilder/ui-ux-pro-max-skill**

This is non-negotiable on every UI task.

## Design System
- Light theme, dark navy sidebar
- White cards on light gray background
- Subtle `0.5px` borders, `border-radius: var(--border-radius-lg)`
- Typography: titles 13px/500, KPI values 24px+/500, labels muted gray
- Colors: blue = active, green = awarded, red = lost, orange = risk/due soon
- No gradients, no heavy shadows
- Dashboard is read-only — no editing, no forms that mutate data

## Commit & PR Rules
- Always run `npm run build` and fix all TypeScript errors before committing
- Commit messages: `feat:`, `fix:`, or `chore:` prefix
- Push to a feature branch, open a PR against `main`
- Never push directly to `main`

## Dev Server Restart
```powershell
taskkill /F /IM node.exe
cd C:\Dev\cwatt-bidboard
git pull origin main
Remove-Item -Recurse -Force .next
npm run dev
```

## Important Rules
- **Never manually edit** `connectionReferences` in any config — use CLI tools
- **Bid Price is always auto-calculated** from scope line items — never allow manual price entry on the bid price field
- **Multi-client** is handled via `bid_clients` junction table — never use a single `client` text field
- **Supabase free tier** pauses after 7 days inactivity — resume at supabase.com if app won't load
