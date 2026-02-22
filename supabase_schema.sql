-- Supabase Schema for WhatsApp Automation

-- Create extension if missing
create extension if not exists "uuid-ossp";

-- 1. Profiles Table (Linked to Auth Users)
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  payment_status boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Profiles
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. Contacts Table
create table public.contacts (
  id uuid default uuid_generate_v4() primary key,
  name text,
  phone_number text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (phone_number)
);

-- Enable RLS for Contacts (Global Access for Authenticated Users)
alter table public.contacts enable row level security;
create policy "Users can view all contacts" on public.contacts for select using (auth.role() = 'authenticated');
create policy "Users can insert contacts" on public.contacts for insert with check (auth.role() = 'authenticated');
create policy "Users can delete contacts" on public.contacts for delete using (auth.role() = 'authenticated');

-- 3. Storage Policies (broadcast-images bucket)
-- Note: Assuming the bucket "broadcast-images" is already created and set to Public.
create policy "Public access to broadcast images"
on storage.objects for select
using ( bucket_id = 'broadcast-images' );

create policy "Authenticated users can upload broadcast images"
on storage.objects for insert
with check ( bucket_id = 'broadcast-images' and auth.role() = 'authenticated');

create policy "Authenticated users can update broadcast images"
on storage.objects for update
using ( bucket_id = 'broadcast-images' and auth.role() = 'authenticated');

create policy "Authenticated users can delete broadcast images"
on storage.objects for delete
using ( bucket_id = 'broadcast-images' and auth.role() = 'authenticated');

-- 4. Message Logs Table (For Tracking Broadcasts & Clicks)
create table public.message_logs (
  id uuid default uuid_generate_v4() primary key,
  message_id text not null,
  contact_phone text not null,
  template_name text not null,
  status text default 'sent',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Message Logs
alter table public.message_logs enable row level security;
create policy "Users can view message logs" on public.message_logs for select using (auth.role() = 'authenticated');
create policy "Users can insert message logs" on public.message_logs for insert with check (auth.role() = 'authenticated');
create policy "Users can update message logs" on public.message_logs for update using (auth.role() = 'authenticated');
