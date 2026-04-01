

## Plano: Adicionar suporte a envio de mídia nos nós de fluxo do chatbot

### Problema
O nó de mensagem no Flow Builder permite configurar `mediaUrl` e `mediaType` (imagem, vídeo, documento, áudio), mas o motor de execução do chatbot (`whatsapp-chatbot/index.ts`, linhas 1932-1936) **só lê `messageText`** e ignora completamente esses campos. O fluxo "Ebook - Mucujá" tem um documento do Google Drive configurado como `mediaUrl`, mas ele nunca é enviado.

### Causa Raiz
No BFS de execução de fluxos (linha 1932):
```typescript
if (node.type === "message" && node.data?.messageText) {
  let msg = node.data.messageText.replace(...);
  responseMessages.push(msg);
}
```
Não há tratamento para `node.data.mediaUrl` ou `node.data.mediaType`.

### Correção

**Arquivo: `supabase/functions/whatsapp-chatbot/index.ts`**

1. **No BFS de execução de fluxos (após linha 1936)**: Após processar `messageText`, verificar se o nó tem `mediaUrl` e `mediaType`. Se tiver, enviar a mídia via Meta Cloud API ou incluir o link na resposta para EVAdesk.

2. **Para o provider `meta_cloud`**: Usar a Graph API para enviar documento/imagem/vídeo/áudio como mensagem separada (endpoint `POST /{phone_number_id}/messages` com tipo `document`, `image`, etc.).

3. **Para o provider `evadesk`**: Como o EVAdesk recebe resposta via HTTP body, incluir o `mediaUrl` como link adicional no texto da resposta (já que o EVAdesk não suporta mídia inline no webhook de retorno).

4. **Implementação concreta**:
   - Criar função `sendMediaMessage(supabase, intSettings, provider, phone, mediaUrl, mediaType, caption, tenantId, phoneNumberIdOverride)` que:
     - Para Meta Cloud: envia via Graph API como mensagem de mídia
     - Para EVAdesk: acumula o link no `_evadeskResponseAccumulator`
   - No BFS, após `responseMessages.push(msg)`, chamar `sendMediaMessage` se `node.data.mediaUrl` existir
   - Acumular metadados de mídia na resposta para EVAdesk incluir no payload de retorno

5. **Redeploy** da edge function.

### Resultado
Quando "Mucujá" ou "ebook" for enviado, o chatbot enviará tanto o texto quanto o documento PDF/link do Google Drive ao usuário.

