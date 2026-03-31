ALTER TABLE public.whatsapp_chatbot_flows
ADD COLUMN phone_number_ids text[] DEFAULT NULL;

COMMENT ON COLUMN public.whatsapp_chatbot_flows.phone_number_ids IS 'List of Meta phone_number_ids this flow applies to. NULL means all numbers.';