create type branch as enum ('Branch 1', 'Branch 2', 'Branch 3', 'Branch 4', 'Branch 5');
create type scope as enum ('Ductwork', 'Piping', 'Firestop', 'Combo');
create type bid_status as enum ('Unassigned', 'Bidding', 'In Progress', 'Sent');

create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  branch branch not null,
  role text not null default 'estimator',
  created_at timestamp with time zone default now()
);

create table bids (
  id uuid default gen_random_uuid() primary key,
  project_name text not null,
  client text not null,
  scope scope not null,
  branch branch not null,
  estimator_id uuid references profiles(id) on delete set null,
  bid_price numeric,
  status bid_status not null default 'Unassigned',
  bid_due_date date not null,
  project_start_date date,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table profiles enable row level security;
alter table bids enable row level security;

create policy "Users can view all profiles" on profiles
  for select using (true);

create policy "Users can view all bids" on bids
  for select using (true);

create policy "Authenticated users can insert bids" on bids
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update bids" on bids
  for update using (auth.role() = 'authenticated');
