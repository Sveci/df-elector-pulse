import { useState, useEffect, useCallback } from "react";

export interface BulkSendSession {
  id: string;
  channel: "whatsapp" | "email";
  templateId: string;
  templateSlug: string;
  templateName: string;
  recipientType: string;
  targetEventId?: string;
  targetFunnelId?: string;
  targetSurveyId?: string;
  totalRecipients: number;
  sentIdentifiers: string[]; // telefones ou emails já enviados
  startedAt: string;
  lastUpdatedAt: string;
  batchSize: string;
}

const WHATSAPP_SESSION_KEY = "whatsapp_bulk_session";
const EMAIL_SESSION_KEY = "email_bulk_session";

export function useBulkSendSession(channel: "whatsapp" | "email") {
  const sessionKey = channel === "whatsapp" ? WHATSAPP_SESSION_KEY : EMAIL_SESSION_KEY;

  const [pendingSession, setPendingSession] = useState<BulkSendSession | null>(null);
  const [showResumeDialog, setShowResumeDialog] = useState(false);

  // Carregar sessão pendente ao inicializar
  useEffect(() => {
    const savedSession = localStorage.getItem(sessionKey);
    if (savedSession) {
      try {
        const session: BulkSendSession = JSON.parse(savedSession);
        // Verificar se há progresso pendente (enviados < total)
        if (session.sentIdentifiers?.length < session.totalRecipients) {
          setPendingSession(session);
          setShowResumeDialog(true);
        } else {
          // Sessão completa, limpar
          localStorage.removeItem(sessionKey);
        }
      } catch (e) {
        localStorage.removeItem(sessionKey);
      }
    }
  }, [sessionKey]);

  // Iniciar nova sessão
  const startSession = useCallback((
    templateId: string,
    templateSlug: string,
    templateName: string,
    recipientType: string,
    totalRecipients: number,
    batchSize: string,
    targetEventId?: string,
    targetFunnelId?: string,
    targetSurveyId?: string
  ) => {
    const session: BulkSendSession = {
      id: crypto.randomUUID(),
      channel,
      templateId,
      templateSlug,
      templateName,
      recipientType,
      targetEventId,
      targetFunnelId,
      targetSurveyId,
      totalRecipients,
      sentIdentifiers: [],
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      batchSize,
    };
    localStorage.setItem(sessionKey, JSON.stringify(session));
    setPendingSession(null);
    setShowResumeDialog(false);
    return session;
  }, [channel, sessionKey]);

  // Registrar envio bem-sucedido
  const markSent = useCallback((identifier: string) => {
    const savedSession = localStorage.getItem(sessionKey);
    if (savedSession) {
      try {
        const session: BulkSendSession = JSON.parse(savedSession);
        if (!session.sentIdentifiers.includes(identifier)) {
          session.sentIdentifiers.push(identifier);
          session.lastUpdatedAt = new Date().toISOString();
          localStorage.setItem(sessionKey, JSON.stringify(session));
        }
      } catch (e) {
        console.error("Erro ao salvar progresso:", e);
      }
    }
  }, [sessionKey]);

  // Obter identificadores já enviados
  const getSentIdentifiers = useCallback((): Set<string> => {
    const savedSession = localStorage.getItem(sessionKey);
    if (savedSession) {
      try {
        const session: BulkSendSession = JSON.parse(savedSession);
        return new Set(session.sentIdentifiers || []);
      } catch (e) {
        return new Set();
      }
    }
    return new Set();
  }, [sessionKey]);

  // Limpar sessão (concluída ou descartada)
  const clearSession = useCallback(() => {
    localStorage.removeItem(sessionKey);
    setPendingSession(null);
    setShowResumeDialog(false);
  }, [sessionKey]);

  // Fechar dialog sem descartar
  const dismissDialog = useCallback(() => {
    setShowResumeDialog(false);
  }, []);

  // Calcular progresso pendente
  const getPendingCount = useCallback(() => {
    if (!pendingSession) return 0;
    return pendingSession.totalRecipients - pendingSession.sentIdentifiers.length;
  }, [pendingSession]);

  return {
    pendingSession,
    showResumeDialog,
    setShowResumeDialog,
    startSession,
    markSent,
    getSentIdentifiers,
    clearSession,
    dismissDialog,
    getPendingCount,
  };
}
