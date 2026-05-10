# BidWatt — Session 1 Product Audit

Scope: Authentication / login, Dashboard, My Workspace (kanban + KPI row + To-Do + Recent Activity + Add Bid), Main sidebar, Top header / user menu / sign out, BidDetailDrawer pop-out (since it's reachable from these surfaces).

## Summary

| Priority | Count |
|---------:|------:|
| **P0**   | 4     |
| **P1**   | 8     |
| **P2**   | 12    |
| **P3**   | 7     |
| **Total**| 31    |

Hot spots:

- `NewBidDialog` writes legacy `bid_line_items.client` text instead of the `bid_clients` junction table — violates a hard rule in `CLAUDE.md` and breaks multi-client display elsewhere.
- Kanban filters out any bid whose `bid_due_date` isn't in the current calendar week, including most `Sent` bids — they vanish from the board immediately after submission.
- Login screen swallows redirect-time error codes (`account_inactive`, `profile_fetch_failed`) — users are bounced with no explanation.
- App is desktop-only: `proxy.ts` and `dashboard/layout.tsx` both assume a fixed 192px / 56px sidebar with `margin-left`, with zero responsive behavior under ~900px.

---

## 1. Authentication / Login flow

Files: `app/login/page.tsx`, `app/auth/callback/route.ts`, `proxy.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `contexts/userRole.tsx`.

### P1 — Login page never displays redirect error codes
`contexts/userRole.tsx:48-55` signs the user out and redirects to `/login?error=profile_fetch_failed` or `?error=account_inactive`, but `app/login/page.tsx` never reads `searchParams`, so the user lands on a clean login form with no explanation. They'll re-enter credentials, succeed, and be kicked again with the same silent loop.
Fix: read `error` from `useSearchParams()` and render a friendly mapped message.

### P1 — `redirect('/login')` after `signOut` doesn't always invalidate the client cache
`app/dashboard/sidebar-client.tsx:276-280` calls `supabase.auth.signOut()` then `router.push('/login')`. `router.push` performs a soft client navigation; React state and the in-memory Supabase client survive. Combined with the proxy guard, this works, but if the user immediately hits the back button they can briefly see cached dashboard markup before the proxy redirect fires. Use `router.replace('/login')` and follow with `router.refresh()` to evict the React cache, or perform sign-out on the server.

### P2 — Login route is publicly reachable when already authenticated
`proxy.ts:9` always lets `/login` through. An authenticated user can re-visit `/login` and re-authenticate, briefly displaying the form. Should redirect to `/dashboard` if a session exists.

### P2 — No password reset, no "remember me", no MFA hint
`app/login/page.tsx` is a single email+password form. No "Forgot password" link, no link to request access, no support contact. With Supabase magic-link / reset already available this is one extra anchor.

### P2 — `signInWithPassword` errors are surfaced raw to the user
`app/login/page.tsx:27` displays Supabase's exact `error.message` (e.g. `Invalid login credentials`). Fine, but ambiguous between "wrong password" and "deactivated account" — combined with the silent redirect bug above, users can't self-diagnose.

### P3 — No `autoComplete` hints on email/password
`app/login/page.tsx:48-65` — add `autoComplete="email"` / `autoComplete="current-password"` so password managers reliably autofill.

### P3 — Form submit button has no visible focus state from keyboard
The shadcn `Button` provides default focus ring, but it's worth verifying against the design tokens used here.

### Security note
- Proxy correctly refuses unauthenticated traffic for everything except `/login` and `/auth/callback` (`proxy.ts:9-11`) — good.
- `getUser()` is used (not `getSession()`) — good, this validates the JWT server-side.
- No env-var leakage in client components — both Supabase clients consume `NEXT_PUBLIC_*` only, service role lives elsewhere.

---

## 2. Dashboard route

Files: `app/dashboard/page.tsx`, `components/dashboard/{AdminDashboard,BranchManagerDashboard,EstimatorDashboard}.tsx`, `hooks/useDashboard.ts`.

### P0 — `EstimatorDashboard` and `BranchManagerDashboard` read clients from the deprecated `bid_line_items.client` field
`components/dashboard/EstimatorDashboard.tsx:67-68` and `components/dashboard/BranchManagerDashboard.tsx:73`:
```ts
const clients = [...new Set((bid.line_items ?? []).map((li) => li.client).filter(Boolean))]
```
`CLAUDE.md` is explicit: *"Multi-client is handled via `bid_clients` junction table — never use a single `client` text field."* The data fetched in `useDashboard` includes `bid_clients`, but these dashboards ignore it and read the legacy column instead. After Session 2's data backfill removes `bid_line_items.client`, both dashboards will show no clients at all. AdminDashboard already does this correctly (`components/dashboard/AdminDashboard.tsx:628-636` uses `bid.clients` + `getBidClientName`).

### P1 — Global Time Range filter has no effect on the Estimator or Branch Manager dashboards
`app/dashboard/page.tsx:18-87` renders a `timeRange` segmented control and passes it only to `AdminDashboard`. `BranchManagerDashboard` and `EstimatorDashboard` accept no `timeRange` prop. End users with non-admin roles will click the control and see no UI change. Either remove the control for those roles or pipe `timeRange` into the other two dashboards.

### P1 — `AdminDashboard`'s KPI row is "personal", not org-wide
`AdminDashboard.tsx:732-799` computes `Total Secured`, `Open Bids`, `Bids Sent`, and `Win Rate` from `filteredBids`, which is sourced from `useDashboard().allBids` — a query filtered to `estimator_id = profile.id` (`hooks/useDashboard.ts:219-222`). An admin who isn't actively bidding will see all four KPIs at 0/N/A even when the org has plenty of activity. The org-wide arrays (`orgBids`, `filteredOrgBids`) are only used in the lower charts.

### P1 — "Recent Bids" header says "sorted by last updated", actually sorted by `created_at`
`AdminDashboard.tsx:914-941` ships the description *"Up to 8 bids, sorted by last updated"* but the supplying query (`hooks/useDashboard.ts:217`) orders by `created_at desc`. A bid edited yesterday won't bubble up.

### P1 — Recent Bids table ignores the global Time Range
`AdminDashboard.tsx:940-944` passes `allBids` (unfiltered) into `RecentBidsTable`, not `filteredBids`. The first 8 bids always show regardless of the user's "This Month / This Quarter / …" selection.

### P2 — `BranchManagerDashboard` cannot see admin-level pipeline charts
The branch manager dashboard ends with "Estimator Performance" and "Bids Due This Week" — no equivalent of the admin's Active Pipeline or Pipeline Trend cards. If that's intentional, document it; if not, share the chart components.

### P2 — `useDashboard` runs two `bids` queries for admin/BM
`hooks/useDashboard.ts:214-251`: a "personal" query and an "org" query are issued in parallel. For admin users, the personal query is a strict subset of the org query and is wasted work. Branch managers similarly. Collapse to a single query and filter in memory.

### P2 — `formatCurrency` truncates large values without unit consistency
`AdminDashboard.tsx:33-37`: `$1.5M`, `$15K`, `$15` — fine for compactness, but Recent Bids and the legend share the same formatter, so a $999 bid renders as `$999` next to `$1.0M` totals. Consider using `formatCurrencyFull` in the table cells where horizontal space allows.

### P2 — `computeStats` compares possibly-null `bid_due_date` strings with operators
`hooks/useDashboard.ts:97-102` does `b.bid_due_date >= todayStr && b.bid_due_date <= weekStr` without first checking that `bid_due_date` is non-null. In TS land `null >= '2025-...'` evaluates `false`, so it's "safe" — but defensive code would be `b.bid_due_date != null && …`.

### P3 — `bidsDueThisWeek` is reused by EstimatorDashboard but it is sourced from `bids` (personal). Admin who has no personal bids will see "No bids due this week." even when his team has plenty. Same root cause as the KPI bug above.

### P3 — Pipeline Trend's weekly bucket counts a bid each time it is updated within that week
`AdminDashboard.tsx:284-293` aggregates `total_price` per bid that has `updated_at` inside the week. A single bid updated three weeks in a row counts in all three weeks. Probably not the user's intent for a "Pipeline Trend"; consider per-bid snapshotting via `created_at` or a status-history table.

### P3 — Dashboard skeleton mismatches actual layout
`app/dashboard/page.tsx:20-34` renders a 4-card / 2-chart skeleton for *all* roles, then the real Admin dashboard renders 4 KPIs + 4 charts + a wide table. Estimator only shows 4 KPIs + 2 lists. The shimmer pop is jarring; co-locate role-aware skeletons inside each dashboard component.

---

## 3. My Workspace — Kanban

Files: `app/dashboard/kanban/page.tsx`, `components/kanban/{KanbanColumn,BidCard}.tsx`, `hooks/useBids.ts`.

### P0 — Bids vanish from the kanban once their `bid_due_date` passes
`app/dashboard/kanban/page.tsx:88-113` filters every column except `Unassigned` through `inCurrentWeek`, which requires `bid_due_date >= startOfWeek && bid_due_date <= endOfWeek`. The moment Sunday rolls over (or the day after a bid was due), the bid drops off the board even though it's still in `Bidding` / `In Progress` / `Sent`. The result is a chronically empty `Sent` column — a bid submitted last week disappears from the workspace, and there is no UI to surface it back.
Fix options: (a) include `currentWeekOrFuture` everywhere, not just Unassigned; (b) add a "Show older" toggle; (c) drop the date filter entirely for non-Unassigned columns.

### P0 — Kanban omits the `Lost` (and `Awarded`) columns documented in `CLAUDE.md`
`CLAUDE.md` says columns are `Unassigned / Bidding / In Progress / Sent / Lost`. `app/dashboard/kanban/page.tsx:20` only renders 4: `['Unassigned', 'Bidding', 'In Progress', 'Sent']`. A bid moved to `Lost` from the BidDetailDrawer disappears with no way to drag it back from the kanban. Either render the column or document the change.

### P1 — `Claim` button is racy
`components/kanban/BidCard.tsx:53-70` updates the bid with `.eq('id', bid.id)` only. Two estimators clicking `Claim` simultaneously both succeed; last write wins, the first claimer silently loses the bid the moment realtime reconciles. The update should be conditional: `.eq('id', bid.id).is('estimator_id', null)` then handle the "0 rows updated" case with a toast.

### P1 — Drag-and-drop has no validation when the target column requires fields
Dragging into `Sent` only opens the BidDetailDrawer (`app/dashboard/kanban/page.tsx:81-83`); there is no check that the bid has a price, line items, or even a client. Bids with `total_price = 0` and `TBD` price can be marked `Sent`. The drawer is good for editing afterwards, but the status change is already persisted. Add a guard or wrap status into a transactional "mark as sent" action.

### P1 — `setLocalBids(myBids)` clobbers optimistic state on every realtime tick
`app/dashboard/kanban/page.tsx:30-35` resets `localBids` whenever `bids` changes. The optimistic update on `onDragEnd:57-59` is overwritten as soon as the realtime channel fires `UPDATE` (`hooks/useBids.ts:147-172`), so the card briefly snaps back to its old column before re-rendering in the new one. Most users won't notice on fast networks; on a flaky network this looks like a failure. Track the optimistic delta separately and merge.

### P2 — Loading skeleton renders 6 columns, real UI renders 4
`app/dashboard/kanban/page.tsx:178-192` — cosmetic mismatch.

### P2 — `currentWeekOrFuture` returns `true` when `bid_due_date` is null
`app/dashboard/kanban/page.tsx:102-105`. A new unassigned bid with no due date stays visible forever in Unassigned, even if it was created months ago. Either show it with a `No due date` chip or surface in a separate section.

### P2 — `STATUS_LEFT_BORDER` includes colors for `Awarded` and `Lost` but those columns are never rendered (`components/kanban/KanbanColumn.tsx:13-20`) — dead config.

### P2 — Page restricts content to the user's own bids client-side only
`app/dashboard/kanban/page.tsx:30-34` and `hooks/useBids.ts:82-84` rely on `profile.id === bid.estimator_id`. Defense-in-depth filtering is in place, but the *only* server-side filter for an estimator is `branches IN userBranches` (`useBids.ts:52-56`). Without RLS that scopes to `estimator_id`, an estimator could in theory pull every bid in their branch — and `useBids` does so, just before the client-side filter. Confirm RLS migrations `006_rls_role_policies` actually scope estimators to their own rows; if so, this is fine; if not, P0.

### P3 — `KanbanColumn`'s `+ Add Bid` button on a per-column basis doesn't seed the dropped column
Clicking `+ Add Bid` in `Sent` opens the same `NewBidDialog` with status defaulting to `Bidding` (or `Unassigned` per checkbox). Either prefill `status` from the column or remove the per-column button.

### P3 — `BidCard` re-creates `Intl.NumberFormat` on every render
`components/kanban/BidCard.tsx:34-36` instantiates a new `Intl.NumberFormat` per card per render. Cheap, but pull it to module scope.

### Accessibility
- `BidCard` is a `<div>` with `onClick={() => openBid(bid)}` (`BidCard.tsx:105-109`). It has no `role="button"`, no `tabIndex={0}`, no keyboard handler. Cards are unreachable by keyboard. **P1**.
- The drag-handle is the entire card, but @hello-pangea/dnd's keyboard dragging requires the focusable element to be a button — see their docs.
- "Claim" button has no `aria-busy` while claiming.

---

## 4. My Workspace — KPI row, To-Do, Recent Activity

Files: `components/workspace/{KpiRow,TodoList,RecentActivity}.tsx`, `hooks/useTodos.ts`.

### P1 — KPI row's "Sent" and "Total Bid Value (Week)" are derived from the board, so they inherit the Sent-bid-disappearing bug
`components/workspace/KpiRow.tsx:122-127` and `app/dashboard/kanban/page.tsx:118-123`. The KPI is intentionally kept in sync with what's visible on the board ("KPIs can never disagree with the columns"). That's good design, but compounds the P0 above: after a bid passes its due date, both the column and the KPI silently drop.

### P2 — "View all tasks →" and "View all activity →" are dead buttons
`components/workspace/TodoList.tsx:152-164` and `components/workspace/RecentActivity.tsx:181-191` render styled links with no `onClick` and no `href`. They look interactive but do nothing. Either wire them up (e.g. a `/dashboard/todos` route, an activity log page) or remove.

### P2 — `TodoList` has no per-item delete
Users can only clear *completed* todos. A typo or no-longer-relevant pending todo can't be deleted from the UI even though the underlying table presumably supports `delete`.

### P2 — Optimistic todo IDs are not collision-safe across rapid double-adds
`hooks/useTodos.ts:89-99` uses `temp-${Date.now()}` as the temp key. Two `addTodo` calls within the same millisecond produce the same React key and de-duplication confuses the rollback.

### P2 — `RecentActivity` filters server data client-side instead of issuing the right query
`components/workspace/RecentActivity.tsx:78-82`. The query already does `.eq('user_id', userId)`, so the client filter is defensive only. Comment says it guards against admin/BM RLS, but for a personal-workspace surface the right answer is to use a more restricted Supabase view, not to depend on client-side filtering.

### P2 — `relativeTime` doesn't recompute after mount
`components/workspace/RecentActivity.tsx:18-28`. "just now" stays "just now" for the lifetime of the component. Tick a `setInterval(60_000)` to refresh.

### P3 — `KpiRow`'s "Total Bid Value (Week)" label is misleading
It actually sums every bid currently visible on the board (across columns), which the comment acknowledges. "Total Pipeline (This Week)" or just "Pipeline" would be clearer.

### P3 — `KpiCard` recomputes formatters per render, similar to `BidCard`.

### P3 — TodoList "Add" input has no max length, no character counter, no client-side trim feedback. Free-text bids could end up with 5000-char todos.

### Accessibility
- `TodoList` checkbox toggle (`TodoList.tsx:26-47`) is a `<button>` with no associated label text or `role="checkbox"` / `aria-checked`. Screen readers announce it as "Mark complete button" only after they read the surrounding text; better to use a real `<input type="checkbox">` for state announcement and built-in keyboard semantics. **P2**.
- "Recent Activity" has no `aria-live` region — new entries flow in via realtime with no announcement. **P3**.

---

## 5. New Bid dialog

File: `components/shared/NewBidDialog.tsx`.

### P0 — Writes clients into the deprecated `bid_line_items.client` column, never touches `bid_clients`
`components/shared/NewBidDialog.tsx:293-302`:
```ts
const lineItemsToInsert = values.line_items.flatMap((li) =>
  li.scope_prices.map((sp) => ({
    bid_id: bidId,
    client: li.client ?? '',   // ← writes to legacy column
    scope: sp.scope,
    price: …,
  }))
)
```
No `supabase.from('bid_clients').insert(...)` anywhere in the file. Per `CLAUDE.md`: *"Multi-client is handled via `bid_clients` junction table — never use a single `client` text field."* Every bid created from My Workspace is born with zero entries in `bid_clients`, so the multi-client display elsewhere (BidBoard, BidDetailDrawer, Dashboard) shows "—" or "No client" for every new bid. **Critical — every bid created in Session 1 is broken in Session 2.**

Fix:
1. Replace the free-text `client` `<Input>` with the same client picker used in `BidBoard`'s ghost row, sourcing existing rows from `clients` table.
2. After the bid insert, insert a row per selected client into `bid_clients(bid_id, client_id)`.
3. Drop the `client` column from `bid_line_items` after migration cleanup.

### P1 — Failed line-item insert leaves an orphan activity row
`NewBidDialog.tsx:290` logs `"Created bid"` *before* line items insert. If the line-item insert fails, the bid is deleted (`:305`), but the activity entry is not. `bid_activity` still has a row pointing to a bid_id that no longer exists. Also: not a transaction — between the bid insert and the line-item insert, another client could be reading the half-built bid. Move both inserts into a single Postgres function or skip activity logging until after the line items land.

### P1 — `bid_due_date` validation accepts past dates
`NewBidDialog.tsx:173` — `bid_due_date: z.string().min(1)`. A user can pick a date in 2018. Either enforce `z.string().refine(d => new Date(d) >= today, …)` or surface a clear warning.

### P2 — Estimator can be selected to any user across all branches
`NewBidDialog.tsx:438-470` lists every profile (passed in from `dashboard/layout.tsx`). For an Estimator role, the only valid estimator is themself; for a BranchManager, valid choices should be scoped to their branches. Filter `profiles` by the bid's selected branch.

### P2 — `branch: '' as any` defaultValue circumvents the Zod enum
`NewBidDialog.tsx:212,229`. The form ships an empty string into a `z.enum([...])` field; validation catches this on submit, but it produces type lies elsewhere and the `Select` shows the placeholder. Use `Omit<…, 'branch'> & { branch: Branch | null }` and the Zod schema using `.nullable().refine(v => v !== null, 'Branch is required')`.

### P2 — `mike_estimate_number` is freeform, never checked for uniqueness or format
A user can save two bids with the same MIKE estimate number, or with a non-numeric value (`"foo"`). If MIKE numbers are meant to be unique, add a DB-level unique constraint + client-side check; if not, document the relaxed contract.

### P2 — `Create as Unassigned` checkbox isn't sticky / persistent
Resets to `false` every time the dialog opens (`NewBidDialog.tsx:225`). If a user is bulk-creating unassigned bids, they have to re-check every time.

### P3 — Dialog has no autosave / draft persistence — closing it (escape, click outside) discards everything silently.

### P3 — `ScopePicker` open menu doesn't trap focus and isn't keyboard-driven
`NewBidDialog.tsx:52-153` is a custom dropdown. Tab does not move focus into the open panel; arrow keys don't move between options. Replace with the existing shadcn `DropdownMenuCheckboxItem` primitive, or wire focus management.

---

## 6. Main sidebar + Top header

Files: `app/dashboard/layout.tsx`, `app/dashboard/sidebar-client.tsx`.

### P1 — Layout pre-fetches every user profile in the org for the top-level layout
`app/dashboard/layout.tsx:15-24`:
```ts
supabase.from('profiles').select('id, name, user_branches(branch)').order('name')
```
runs on *every* dashboard navigation. For now the org has ~5–20 estimators; that's fine. But the layout passes `profiles` into `BidDetailProvider` and `Sidebar` for the New Bid dialog's estimator picker. Move that fetch into the dialog itself (lazy on open) and the layout becomes a single round trip.

### P1 — No mobile / small-screen behavior anywhere
`app/dashboard/layout.tsx:36-43` sets a hard `margin-left: var(--main-sidebar-width)` and `app/dashboard/sidebar-client.tsx:111-119` uses a fixed `aside`. Under ~900px the kanban and dashboard overflow, the sidebar covers content, and the user can't dismiss it. Add a mobile breakpoint that converts the sidebar to a Sheet / drawer.

### P2 — Sidebar `Sidebar({ profiles: _profiles })` receives a prop it never uses
`app/dashboard/sidebar-client.tsx:89` — the underscore is honest but the layout still passes it through. Either consume it (estimator picker can live in the sidebar's "user info" footer) or remove.

### P2 — Sidebar collapsed/expanded state is a flash-of-incorrect-content
`app/dashboard/sidebar-client.tsx:92-100` initializes `collapsed = false`, reads `localStorage` *after* mount, then snaps to the persisted value. Users who prefer the collapsed sidebar see a brief expanded flash on every navigation. Either:
- Read the preference from a cookie on the server and pass to the client component as an initial prop, or
- Render the aside hidden until the effect runs and the width is set.

### P2 — Top bar shows the user's first letter as an avatar but nothing else
`sidebar-client.tsx:294-310` — clicking the avatar does nothing. Common pattern is a dropdown with "Profile / Account settings / Sign out". Sign out is the only escape and it's a separate button at the far right — long mouse travel.

### P2 — Top bar branch badges duplicate what the sidebar already shows
`sidebar-client.tsx:312-345` and `:188-231` both render the user's branch chips. Pick one location; the header bar is the better one (sidebar can collapse and lose them).

### P2 — Reports link is shown for `BranchManager` only, not for `Admin`
`sidebar-client.tsx:164-173`. Per `CLAUDE.md`: *"Reports — Branch Manager + Admin only"*. The Reports nav item is hidden from admins because the condition is `isBranchManager` instead of `isBranchManager || isAdmin`. Admins reach reports only by typing the URL.

### P3 — Sidebar links use inline `onMouseEnter/onMouseLeave` for hover instead of CSS
`sidebar-client.tsx:76-81` — heavy event load, hurts scroll performance, defeats `:hover` keyboard focus parity. Replace with Tailwind `hover:` / `data-active`.

### P3 — Sidebar collapse button has no keyboard shortcut documented in the title/aria
Toggle-via-keyboard would be a nice power-user feature (`Cmd+\\` is common). At minimum, the title `Collapse sidebar` could mention the shortcut once one exists.

### P3 — Sidebar icon-only mode hides every label including the brand
Tooltips show on hover (`title={collapsed ? label : undefined}` on `:60`) — fine — but no aria-label, so a screen reader navigating the collapsed sidebar reads only "link". Add `aria-label={label}`.

### Accessibility
- `Sign out` button has no `aria-label` — a screen reader does read the text, so this is fine. **OK.**
- `NavItem` is a `Link` with text content — fine for SR. **OK.**

---

## 7. Cross-cutting / Layout

### P2 — Dashboard layout is not a Suspense boundary
`app/dashboard/layout.tsx` blocks the entire dashboard render on two server queries (`profile` + `profilesRaw`). With Supabase cold-starts this can be 600–1500ms before any UI paints. Wrap in `<Suspense>` and stream.

### P2 — `BidDetailDrawer` is mounted globally inside the layout
`app/dashboard/layout.tsx:44`. It's only used from kanban, bid board, and dashboard pages — fine — but it adds ~13KB JS to every dashboard route including pages that never trigger it (e.g. `/dashboard/toolbox`). Defer with `next/dynamic` and `ssr: false`.

### P3 — `BidDetailProvider` receives `profiles ?? []` twice
`app/dashboard/layout.tsx:31`. The fallback is already in the `.map` above. Pick one.

---

## Additional recommendations (Session 1)

Concrete, file-pinned actions ordered by leverage:

1. **`components/shared/NewBidDialog.tsx`** — replace `client` text writes with `bid_clients` inserts. Reuse `ClientsPopover` from `components/spreadsheet/ClientsPopover.tsx`. Wrap bid + line-items + bid_clients inserts in a single Postgres function (e.g. `create_bid_with_items(...)` returning the new bid id).
2. **`app/dashboard/kanban/page.tsx:88-113`** — change column filtering so non-Unassigned columns include bids whose `bid_due_date` is null OR in the current week OR before the current week. Add a "Show next week" toggle.
3. **`app/dashboard/kanban/page.tsx:20`** — add `'Lost'` (and probably `'Awarded'`) to `STATUSES`, or update `CLAUDE.md` to reflect the actual 4-column workflow.
4. **`components/kanban/BidCard.tsx:53-70`** — make `Claim` conditional on `estimator_id IS NULL`; toast on race; replace the global `<div onClick>` with a `<button>` (or `role="button" tabIndex={0}` with key handler) for keyboard access.
5. **`components/dashboard/EstimatorDashboard.tsx:67-68` and `BranchManagerDashboard.tsx:73`** — replace `li.client` reads with `(bid.clients ?? []).map(getBidClientName)` (already imported in AdminDashboard).
6. **`app/dashboard/page.tsx`** — either remove the `timeRange` segmented control for non-admin roles or pipe it into `BranchManagerDashboard` / `EstimatorDashboard`.
7. **`app/login/page.tsx`** — `useSearchParams()` and render mapped errors for `account_inactive`, `profile_fetch_failed`. Add `autoComplete` on inputs.
8. **`app/dashboard/sidebar-client.tsx:164-173`** — change `isBranchManager` to `isBranchManager || isAdmin` for the Reports nav item.
9. **`components/workspace/TodoList.tsx:152-164` and `components/workspace/RecentActivity.tsx:181-191`** — either wire the "View all" buttons to real routes or remove them.
10. **`app/dashboard/layout.tsx`** — move the per-navigation `profiles` fetch into `NewBidDialog`'s open handler (lazy). Add a mobile breakpoint that hides the fixed sidebar and replaces it with a `Sheet`.
11. **`hooks/useDashboard.ts:217`** — order Recent Bids by `updated_at` to match the UI's promise. For admin/BM, collapse the dual queries into a single org query and derive personal stats client-side.
12. **`components/shared/NewBidDialog.tsx:438-470`** — filter `profiles` to those who have at least one branch in common with the bid's selected branch.
13. **`components/kanban/BidCard.tsx:34-36`** and **`components/workspace/KpiRow.tsx:12-18`** — hoist `Intl.NumberFormat` to module scope.
14. **`proxy.ts:9`** — if `pathname.startsWith('/login')`, verify there isn't already a session, and redirect to `/dashboard` if so.
