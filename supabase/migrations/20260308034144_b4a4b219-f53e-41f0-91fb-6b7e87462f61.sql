UPDATE sms_templates SET mensagem = 'Olá {{nome}}! Obrigado por se cadastrar com {{politico}} - {{cargo}}. Acompanhe as novidades!', variaveis = '["nome", "politico", "cargo"]'::jsonb WHERE slug = 'captacao-boas-vindas-sms';

UPDATE sms_templates SET mensagem = '{{nome}}, {{politico}} ({{cargo}}) convida para {{evento_nome}} em {{evento_data}}. Inscreva-se: {{link}}', variaveis = '["nome", "politico", "cargo", "evento_nome", "evento_data", "link"]'::jsonb WHERE slug = 'evento-convite-sms';

UPDATE sms_templates SET mensagem = '{{nome}}, fotos de {{evento_nome}} - {{cargo}} {{politico}} disponíveis! Acesse: {{link}}', variaveis = '["nome", "politico", "cargo", "evento_nome", "link"]'::jsonb WHERE slug = 'evento-fotos-sms';

UPDATE sms_templates SET mensagem = '{{nome}}, lembrete do {{cargo}} {{politico}}: {{evento_nome}} amanhã às {{evento_hora}}. Local: {{evento_local}}', variaveis = '["nome", "politico", "cargo", "evento_nome", "evento_hora", "evento_local"]'::jsonb WHERE slug = 'evento-lembrete-sms';

UPDATE sms_templates SET mensagem = '{{nome}}, material exclusivo do {{cargo}} {{politico}} para sua região: {{link}}', variaveis = '["nome", "politico", "cargo", "link"]'::jsonb WHERE slug = 'material-regiao-sms';

UPDATE sms_templates SET mensagem = '{{nome}}, o {{cargo}} {{politico}} quer sua opinião! Participe: {{link}}', variaveis = '["nome", "politico", "cargo", "link"]'::jsonb WHERE slug = 'pesquisa-convite-sms';