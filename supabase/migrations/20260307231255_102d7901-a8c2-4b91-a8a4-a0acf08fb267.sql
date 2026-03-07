ALTER PUBLICATION supabase_realtime ADD TABLE public.active_sessions;

ALTER TABLE public.active_sessions REPLICA IDENTITY FULL;