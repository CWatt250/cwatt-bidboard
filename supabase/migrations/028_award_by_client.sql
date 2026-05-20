-- Award-by-Client tracking (#6)
-- Adds awarded_to_client_id FK on bid_line_items; ensures awarded_at
-- exists. Adds two RPCs for atomic award/unaward.

-- 1. Columns (idempotent)
alter table public.bid_line_items
  add column if not exists awarded_to_client_id uuid
    references public.clients(id) on delete set null;

alter table public.bid_line_items
  add column if not exists awarded_at timestamptz;

create index if not exists bid_line_items_awarded_to_client_idx
  on public.bid_line_items (awarded_to_client_id)
  where awarded_to_client_id is not null;

create index if not exists bid_line_items_bid_awarded_idx
  on public.bid_line_items (bid_id, awarded_to_client_id);

-- 2. Award RPC — silently transfers scopes from previous winners.
create or replace function public.award_client(
  p_bid_id uuid,
  p_client_id uuid
) returns void
language plpgsql
as $$
begin
  update public.bid_line_items bli
  set awarded_to_client_id = p_client_id,
      is_awarded = true,
      awarded_at = now()
  from public.bid_clients bc
  where bli.bid_id = p_bid_id
    and bc.bid_id  = p_bid_id
    and bc.client_id = p_client_id
    and bli.scope::text = any(bc.scopes);
end;
$$;

-- 3. Unaward RPC — clears all this client's wins on this bid.
create or replace function public.unaward_client(
  p_bid_id uuid,
  p_client_id uuid
) returns void
language plpgsql
as $$
begin
  update public.bid_line_items
  set awarded_to_client_id = null,
      is_awarded = false,
      awarded_at = null
  where bid_id = p_bid_id
    and awarded_to_client_id = p_client_id;
end;
$$;

-- 4. Permissions
revoke execute on function public.award_client(uuid, uuid)   from public;
revoke execute on function public.unaward_client(uuid, uuid) from public;
grant  execute on function public.award_client(uuid, uuid)   to authenticated;
grant  execute on function public.unaward_client(uuid, uuid) to authenticated;
