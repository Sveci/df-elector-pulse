CREATE OR REPLACE FUNCTION public.update_chatbot_session_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chatbot_sessions_updated_at
  BEFORE UPDATE ON public.whatsapp_chatbot_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chatbot_session_updated_at();