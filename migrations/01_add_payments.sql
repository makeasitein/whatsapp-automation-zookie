-- Payment history table for Prepaid Model
create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  amount integer not null, -- amount in paise
  currency text default 'INR',
  order_id text,
  payment_id text,
  status text default 'success',
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz default now()
);

-- Enable RLS for payments
alter table public.payments enable row level security;

-- Policies for payments
create policy "Users can view their own payments" 
  on public.payments for select 
  to authenticated
  using (auth.uid() = user_id);

-- Service role bypass needed for inserts in backend (which uses service key),
-- but authenticated users generally don't insert payments directly (backend does).
-- If RLS is enabled, service_role bypasses it by default.
