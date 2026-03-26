-- Insert keyword "PEC 47" with dynamic function
INSERT INTO public.whatsapp_chatbot_keywords (
  keyword, aliases, description, response_type, dynamic_function, is_active, priority, tenant_id
)
SELECT
  'PEC 47',
  ARRAY['PEC47', 'pec 47', 'pec47'],
  'Envia o material da PEC 47 (apresentação PPTX)',
  'dynamic',
  'enviar_pec47',
  true,
  90,
  t.id
FROM public.tenants t
LIMIT 1
ON CONFLICT DO NOTHING;