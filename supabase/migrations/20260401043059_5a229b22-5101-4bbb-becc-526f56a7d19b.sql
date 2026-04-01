INSERT INTO whatsapp_chatbot_config (tenant_id, is_enabled, use_ai_for_unknown, welcome_message, fallback_message, max_messages_per_hour)
VALUES ('7a31e968-7374-410b-b9f6-5d1e7b6802a5', true, true, 'Olá! Como posso ajudar?', 'Desculpe, não entendi. Digite *ajuda* para ver os comandos disponíveis.', 60)
ON CONFLICT DO NOTHING;