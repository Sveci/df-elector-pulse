import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ActiveSession {
  id: string;
  user_id: string;
  session_id: string;
  device_info: string | null;
  ip_address: string | null;
  browser: string | null;
  os: string | null;
  created_at: string;
  last_activity: string;
  expires_at: string | null;
  is_current: boolean;
  force_logout_at: string | null;
  force_logout_reason: string | null;
}

// Gerar um ID único para esta sessão do navegador
const getOrCreateSessionId = (): string => {
  const storageKey = 'active_session_id';
  let sessionId = sessionStorage.getItem(storageKey);
  
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(storageKey, sessionId);
  }
  
  return sessionId;
};

// Detectar informações do dispositivo/navegador
const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  
  // Detectar browser
  let browser = 'Desconhecido';
  if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Edg')) browser = 'Edge';
  else if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Opera')) browser = 'Opera';
  
  // Detectar OS
  let os = 'Desconhecido';
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
  
  // Detectar tipo de dispositivo
  let deviceType = 'Desktop';
  if (/Mobi|Android/i.test(userAgent)) deviceType = 'Mobile';
  else if (/Tablet|iPad/i.test(userAgent)) deviceType = 'Tablet';
  
  return {
    browser,
    os,
    deviceInfo: `${deviceType} - ${browser} no ${os}`
  };
};

export const useActiveSessions = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [forceLogoutAt, setForceLogoutAt] = useState<string | null>(null);
  const [forceLogoutReason, setForceLogoutReason] = useState<string | null>(null);

  // Registrar sessão atual
  const registerSession = useCallback(async () => {
    if (!user?.id) return null;
    
    const sessionId = getOrCreateSessionId();
    const { browser, os, deviceInfo } = getDeviceInfo();
    
    try {
      // Verificar se sessão já existe
      const { data: existingSession } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();
      
      if (existingSession) {
        // Atualizar última atividade
        await supabase
          .from('active_sessions')
          .update({ 
            last_activity: new Date().toISOString(),
            is_current: true 
          })
          .eq('session_id', sessionId);
        
        setCurrentSessionId(sessionId);
        return existingSession;
      }
      
      // Buscar sessões existentes do usuário
      const { data: existingSessions } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      
      // Se há outras sessões, marcar a mais antiga para logout em 5 minutos
      if (existingSessions && existingSessions.length > 0) {
        const oldestSession = existingSessions[0];
        const forceLogoutTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        
        await supabase
          .from('active_sessions')
          .update({ 
            force_logout_at: forceLogoutTime,
            force_logout_reason: 'Nova sessão iniciada em outro dispositivo'
          })
          .eq('id', oldestSession.id);
      }
      
      // Criar nova sessão
      const { data: newSession, error } = await supabase
        .from('active_sessions')
        .insert({
          user_id: user.id,
          session_id: sessionId,
          browser,
          os,
          device_info: deviceInfo,
          is_current: true
        })
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao registrar sessão:', error);
        return null;
      }
      
      setCurrentSessionId(sessionId);
      return newSession;
    } catch (error) {
      console.error('Erro ao registrar sessão:', error);
      return null;
    }
  }, [user?.id]);

  // Buscar sessões ativas
  const fetchSessions = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Marcar sessão atual
      const sessionsWithCurrent = (data || []).map(session => ({
        ...session,
        is_current: session.session_id === getOrCreateSessionId()
      }));
      
      setSessions(sessionsWithCurrent as ActiveSession[]);
      
      // Verificar se a sessão atual tem force_logout_at
      const currentSession = sessionsWithCurrent.find(s => s.is_current);
      if (currentSession?.force_logout_at) {
        setForceLogoutAt(currentSession.force_logout_at);
        setForceLogoutReason(currentSession.force_logout_reason || null);
      }
    } catch (error) {
      console.error('Erro ao buscar sessões:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Encerrar uma sessão específica
  const terminateSession = useCallback(async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('active_sessions')
        .delete()
        .eq('session_id', sessionId);
      
      if (error) throw error;
      
      // Atualizar lista local
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));
      
      return true;
    } catch (error) {
      console.error('Erro ao encerrar sessão:', error);
      return false;
    }
  }, []);

  // Encerrar sessão atual (para logout)
  const terminateCurrentSession = useCallback(async () => {
    const sessionId = getOrCreateSessionId();
    return terminateSession(sessionId);
  }, [terminateSession]);

  // Atualizar última atividade
  const updateLastActivity = useCallback(async () => {
    const sessionId = getOrCreateSessionId();
    
    try {
      await supabase
        .from('active_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('session_id', sessionId);
    } catch (error) {
      console.error('Erro ao atualizar atividade:', error);
    }
  }, []);

  // Limpar força de logout
  const clearForceLogout = useCallback(() => {
    setForceLogoutAt(null);
    setForceLogoutReason(null);
  }, []);

  // Configurar Realtime listener
  useEffect(() => {
    if (!user?.id) return;
    
    const sessionId = getOrCreateSessionId();
    
    const channel = supabase
      .channel('active-sessions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_sessions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Session change:', payload);
          
          // Se a sessão atual foi atualizada com force_logout_at
          if (payload.eventType === 'UPDATE') {
            const updatedSession = payload.new as ActiveSession;
            if (updatedSession.session_id === sessionId && updatedSession.force_logout_at) {
              setForceLogoutAt(updatedSession.force_logout_at);
              setForceLogoutReason(updatedSession.force_logout_reason || null);
            }
          }
          
          // Se uma sessão foi deletada (a outra aba saiu), verificar se devemos limpar o warning
          if (payload.eventType === 'DELETE') {
            const deletedSession = payload.old as ActiveSession;
            // Se a sessão deletada NÃO é a atual, significa que a outra sessão saiu
            // Podemos limpar o force_logout da sessão atual já que não há mais conflito
            if (deletedSession.session_id !== sessionId) {
              // Limpar o force_logout no banco e no state
              supabase
                .from('active_sessions')
                .update({ force_logout_at: null, force_logout_reason: null })
                .eq('session_id', sessionId)
                .then(() => {
                  setForceLogoutAt(null);
                  setForceLogoutReason(null);
                });
            }
          }
          
          // Atualizar lista de sessões
          fetchSessions();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchSessions]);

  // Buscar sessões ao carregar
  useEffect(() => {
    if (user?.id) {
      fetchSessions();
    }
  }, [user?.id, fetchSessions]);

  return {
    sessions,
    currentSessionId: getOrCreateSessionId(),
    isLoading,
    forceLogoutAt,
    forceLogoutReason,
    registerSession,
    fetchSessions,
    terminateSession,
    terminateCurrentSession,
    updateLastActivity,
    clearForceLogout
  };
};
