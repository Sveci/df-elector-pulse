-- Habilitar Realtime para proposições
ALTER PUBLICATION supabase_realtime ADD TABLE proposicoes_monitoradas;
ALTER PUBLICATION supabase_realtime ADD TABLE proposicoes_tramitacoes;

-- REPLICA IDENTITY FULL para DELETE events enviarem dados completos
ALTER TABLE proposicoes_monitoradas REPLICA IDENTITY FULL;
ALTER TABLE proposicoes_tramitacoes REPLICA IDENTITY FULL;
