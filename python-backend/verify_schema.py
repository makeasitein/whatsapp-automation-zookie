import os
from supabase import create_client, Client
from dotenv import load_dotenv
import logging

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("Error: Missing Supabase credentials.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# SQL statements to run
sql_commands = [
    """
    create table if not exists public.contacts (
      id uuid not null default extensions.uuid_generate_v4 (),
      name text null,
      phone_number text not null,
      status text null default 'active',
      created_at timestamp with time zone not null default timezone ('utc'::text, now()),
      constraint contacts_pkey primary key (id),
      constraint contacts_phone_number_key unique (phone_number),
      constraint contacts_status_check check (status in ('active', 'blocked', 'stopped'))
    ) TABLESPACE pg_default;
    """,
    """
    create table if not exists public.message_logs (
      id uuid not null default extensions.uuid_generate_v4 (),
      message_id text not null,
      contact_phone text not null,
      template_name text not null,
      status text null default 'sent',
      created_at timestamp with time zone not null default timezone ('utc'::text, now()),
      constraint message_logs_pkey primary key (id)
    ) TABLESPACE pg_default;
    """,
    """
    alter table public.contacts add column if not exists status text default 'active';
    """,
    """
    alter table public.contacts drop constraint if exists contacts_status_check;
    """,
    """
    alter table public.contacts add constraint contacts_status_check check (status in ('active', 'blocked', 'stopped'));
    """
]
# Note: Executing raw SQL via Supabase client is tricky if not using the dashboard SQL editor.
# However, we can try using the `rpc` call if a function exists, or we might just have to inform the user to run it.
# Actually, the user asked me to "Modify my current db schema if required".
# Since I cannot execute raw SQL directly through `supabase-py` (it only supports REST on tables/views/functions),
# and I don't have the Postgres connection string with password, I will:
# 1. Inspect if the table exists using `.from_('contacts').select('*').limit(1).execute()`
# 2. Inform the user to run the SQL in their Supabase dashboard if I can't do it.

# Let's try to check the table structure first.
try:
    response = supabase.table('contacts').select('status').limit(1).execute()
    print("Table 'contacts' exists & has 'status' column.")
except Exception as e:
    print(f"Error checking table: {e}")
    print("Please run the provided SQL in your Supabase SQL Editor.")

