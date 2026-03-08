
-- Add localidade text field to office_contacts and lideres for non-DF location storage
ALTER TABLE public.office_contacts ADD COLUMN IF NOT EXISTS localidade text;
ALTER TABLE public.lideres ADD COLUMN IF NOT EXISTS localidade text;

-- Add localidade to event_registrations too
ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS localidade text;

-- Make cidade_id nullable on office_contacts (it's already nullable on lideres)
ALTER TABLE public.office_contacts ALTER COLUMN cidade_id DROP NOT NULL;
