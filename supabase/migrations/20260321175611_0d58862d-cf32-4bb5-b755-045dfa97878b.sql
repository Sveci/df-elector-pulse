
-- Add event registration flow columns to whatsapp_chatbot_sessions
ALTER TABLE public.whatsapp_chatbot_sessions
ADD COLUMN IF NOT EXISTS event_reg_state text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS event_reg_event_id uuid DEFAULT NULL,
ADD COLUMN IF NOT EXISTS event_reg_nome text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS event_reg_email text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS event_reg_cidade_id uuid DEFAULT NULL,
ADD COLUMN IF NOT EXISTS event_reg_data_nascimento text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS event_reg_endereco text DEFAULT NULL;

COMMENT ON COLUMN public.whatsapp_chatbot_sessions.event_reg_state IS 'State machine for event registration via WhatsApp: selecting_event, collecting_name, collecting_email, collecting_birthday, collecting_city, completed';
