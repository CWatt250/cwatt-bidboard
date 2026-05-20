create table if not exists bid_change_orders (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references bids(id) on delete cascade,
  co_number text not null,
  co_date date,
  description text,
  value numeric default 0,
  status text default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references profiles(id)
);

create index if not exists bid_change_orders_bid_id_idx on bid_change_orders(bid_id);

-- RLS
alter table bid_change_orders enable row level security;

create policy "Users can view change orders for bids they can see"
  on bid_change_orders for select
  using (
    exists (
      select 1 from bids
      where bids.id = bid_change_orders.bid_id
    )
  );

create policy "Users can insert change orders"
  on bid_change_orders for insert
  with check (auth.uid() is not null);

create policy "Users can update change orders"
  on bid_change_orders for update
  using (auth.uid() is not null);

create policy "Users can delete change orders"
  on bid_change_orders for delete
  using (auth.uid() is not null);
