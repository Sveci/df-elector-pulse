
DELETE FROM public.whatsapp_chatbot_flows 
WHERE is_published = false 
AND name IN ('Boas-Vindas', 'Perguntas Abertas (IA)')
AND tenant_id = '27ed4243-35e5-45fc-bcfc-1d1f969b7377';
