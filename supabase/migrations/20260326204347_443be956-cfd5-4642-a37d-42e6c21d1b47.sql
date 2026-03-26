ALTER PUBLICATION supabase_realtime ADD TABLE proposicoes_monitoradas;
ALTER PUBLICATION supabase_realtime ADD TABLE proposicoes_tramitacoes;
ALTER TABLE proposicoes_monitoradas REPLICA IDENTITY FULL;
ALTER TABLE proposicoes_tramitacoes REPLICA IDENTITY FULL;