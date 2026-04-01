

## Plano: Corrigir extração de texto do EVAdesk via `lastMessage.text`

### Problema
A detecção do payload EVAdesk na linha 703 usa `body.lastContactMessage !== undefined`. Quando o EVAdesk envia um payload onde `lastContactMessage` está **ausente** (undefined) mas `lastMessage.text` contém o texto real, o sistema **não reconhece** como payload EVAdesk e tenta processar como Meta Cloud API — falhando silenciosamente.

### Correção (1 arquivo)

**`supabase/functions/meta-whatsapp-webhook/index.ts`**

1. **Linha 703** — Ampliar a condição de detecção do EVAdesk para incluir `lastMessage`:
   ```typescript
   // ANTES
   if (body.companyId && body.channel && body.lastContactMessage !== undefined)

   // DEPOIS  
   if (body.companyId && body.channel && (body.lastContactMessage !== undefined || body.lastMessage))
   ```

2. **Linha 537** — A extração de texto já está correta (`body.lastMessage?.text || body.lastContactMessage`), mas inverter a prioridade para dar preferência ao campo estruturado:
   ```typescript
   // Manter como está (já prioriza lastMessage.text)
   const messageText = (body.lastMessage?.text || body.lastContactMessage || '').trim();
   ```

3. **Redeploy** da edge function.

### Resultado
Payloads do EVAdesk serão detectados mesmo quando `lastContactMessage` estiver ausente, desde que `lastMessage` exista. O texto será extraído de `lastMessage.text` corretamente.

