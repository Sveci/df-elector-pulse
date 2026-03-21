ALTER TABLE public.whatsapp_chatbot_sessions
ADD COLUMN IF NOT EXISTS last_keyword_at timestamptz DEFAULT NULL;