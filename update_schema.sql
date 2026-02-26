-- Add status column to contacts if it doesn't exist
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Add check constraint to ensure valid status values
ALTER TABLE public.contacts 
DROP CONSTRAINT IF EXISTS contacts_status_check;

ALTER TABLE public.contacts 
ADD CONSTRAINT contacts_status_check 
CHECK (status IN ('active', 'blocked', 'stopped'));

-- Create index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_contacts_status ON public.contacts(status);
