import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveSessions } from './useActiveSessions';

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutos
const WARNING_THRESHOLD = 60 * 1000; // Avisar 1 minuto antes
const ACTIVITY_UPDATE_INTERVAL = 60 * 1000; // Atualizar DB a cada 1 min

export const useInactivityLogout = () => {
  const { isAuthenticated, logout } = useAuth();
  const { updateLastActivity } = useActiveSessions();

  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(60);

  const lastActivityRef = useRef<number>(Date.now());
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const activityUpdateRef = useRef<NodeJS.Timeout | null>(null);

  const clearAllTimers = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const handleLogout = useCallback(async () => {
    clearAllTimers();
    setShowWarning(false);
    await logout();
  }, [logout, clearAllTimers]);

  const startCountdown = useCallback(() => {
    setShowWarning(true);
    setSecondsRemaining(60);

    countdownRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [handleLogout]);

  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    clearAllTimers();
    setShowWarning(false);
    setSecondsRemaining(60);

    if (!isAuthenticated) return;

    // Timer para mostrar aviso (9 minutos)
    warningTimerRef.current = setTimeout(() => {
      startCountdown();
    }, INACTIVITY_TIMEOUT - WARNING_THRESHOLD);

    // Timer para logout (10 minutos) - backup caso o countdown falhe
    inactivityTimerRef.current = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_TIMEOUT);
  }, [isAuthenticated, clearAllTimers, startCountdown, handleLogout]);

  const continueSession = useCallback(() => {
    resetInactivityTimer();
    updateLastActivity();
  }, [resetInactivityTimer, updateLastActivity]);

  // Monitorar eventos de atividade
  useEffect(() => {
    if (!isAuthenticated) {
      clearAllTimers();
      return;
    }

    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click'
    ];

    let throttleTimeout: NodeJS.Timeout | null = null;

    const handleActivity = () => {
      // Throttle para evitar múltiplas chamadas
      if (throttleTimeout) return;

      throttleTimeout = setTimeout(() => {
        throttleTimeout = null;
      }, 1000);

      // Só reseta se não estiver mostrando o aviso
      if (!showWarning) {
        resetInactivityTimer();
      }
    };

    // Iniciar timer
    resetInactivityTimer();

    // Adicionar listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Atualizar last_activity no DB periodicamente
    activityUpdateRef.current = setInterval(() => {
      if (Date.now() - lastActivityRef.current < ACTIVITY_UPDATE_INTERVAL) {
        updateLastActivity();
      }
    }, ACTIVITY_UPDATE_INTERVAL);

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearAllTimers();
      if (activityUpdateRef.current) {
        clearInterval(activityUpdateRef.current);
      }
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
    };
  }, [isAuthenticated, showWarning, resetInactivityTimer, updateLastActivity, clearAllTimers]);

  return {
    showWarning,
    secondsRemaining,
    continueSession
  };
};
