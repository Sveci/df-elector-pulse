
-- Inserir fluxo visual PEC 47 no Flow Builder
INSERT INTO whatsapp_chatbot_flows (
  tenant_id, name, description, is_active, is_published, version,
  color, icon, tags, nodes, edges
) VALUES (
  '27ed4243-35e5-45fc-bcfc-1d1f969b7377',
  'PEC 47 - Envio de Material',
  'Envia automaticamente o material PPTX sobre a PEC 47 quando o usuário envia a palavra-chave "PEC 47"',
  true,
  true,
  1,
  '#ef4444',
  '📄',
  ARRAY['pec47', 'documento', 'automação'],
  '[
    {
      "id": "trigger-1",
      "type": "trigger",
      "position": { "x": 60, "y": 200 },
      "data": {
        "label": "Palavra-chave PEC 47",
        "triggerType": "keyword",
        "keyword": "PEC 47",
        "description": "Dispara quando o usuário envia PEC 47 ou PEC47"
      }
    },
    {
      "id": "keyword-1",
      "type": "keyword",
      "position": { "x": 320, "y": 200 },
      "data": {
        "label": "Detectar PEC 47",
        "keyword": "PEC 47",
        "aliases": ["PEC47", "pec 47", "pec47"],
        "caseSensitive": false,
        "partialMatch": true,
        "description": "Identifica a palavra-chave PEC 47 com ou sem espaço"
      }
    },
    {
      "id": "automation-1",
      "type": "automation",
      "position": { "x": 580, "y": 200 },
      "data": {
        "label": "Enviar Material PEC 47",
        "automationFunction": "enviar_pec47",
        "automationParams": {},
        "description": "Envia o arquivo PPTX PEC47_AMAPA_ESPECIFICO_V5_FINAL.pptx via WhatsApp"
      }
    },
    {
      "id": "end-1",
      "type": "end",
      "position": { "x": 840, "y": 200 },
      "data": {
        "label": "Finalizar",
        "endAction": "nothing",
        "description": "Encerra o fluxo após envio do material"
      }
    }
  ]'::jsonb,
  '[
    { "id": "e1", "source": "trigger-1", "target": "keyword-1", "animated": true },
    { "id": "e2", "source": "keyword-1", "target": "automation-1", "animated": true },
    { "id": "e3", "source": "automation-1", "target": "end-1" }
  ]'::jsonb
);
