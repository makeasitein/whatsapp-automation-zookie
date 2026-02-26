-- Migration to clean up subscription columns and ensure prepaid schema

-- 1. Remove subscription-related columns from profiles
-- Use safe ALTER TABLE commands
alter table public.profiles 
  drop column if exists razorpay_subscription_id,
  drop column if exists razorpay_customer_id, 
  drop column if exists subscription_status;

-- 2. Ensure valid_until exists (if not added by previous scripts manually)
alter table public.profiles 
  add column if not exists valid_until timestamptz;

-- 3. (Optional) You might want to keep payment_status as a boolean quick-check, 
-- or derive it strictly from valid_until. For now we keep it compatible with existing code.
alter table public.profiles 
  alter column payment_status set default false;
