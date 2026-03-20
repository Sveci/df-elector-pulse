import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useActiveSessions } from '@/hooks/useActiveSessions';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export const SessionLogoutWarning = () => {
  const { forceLogoutAt, forceLogoutReason, clearForceLogout, terminateCurrentSession } = useActiveSessions();
  const { logout } = useAuth();
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Calcular tempo restante
  const calculateTimeRemaining = useCallback(() => {
    if (!forceLogoutAt) return null;

    const now = Date.now();
    const logoutTime = new Date(forceLogoutAt).getTime();
    const remaining = Math.max(0, Math.floor((logoutTime - now) / 1000));

    return remaining;
  }, [forceLogoutAt]);

  // Atualizar contador a cada segundo
  useEffect(() => {
    if (!forceLogoutAt || dismissed) {
      setTimeRemaining(null);
      return;
    }

    // Calcular tempo inicial
    const initialRemaining = calculateTimeRemaining();
    setTimeRemaining(initialRemaining);

    // Atualizar a cada segundo
    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);

      // Se chegou a 0, fazer logout
      if (remaining !== null && remaining <= 0) {
        clearInterval(interval);
        handleForceLogout();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [forceLogoutAt, dismissed, calculateTimeRemaining]);

  const handleForceLogout = async () => {
    await terminateCurrentSession();
    clearForceLogout();
    logout();
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  // Formatar tempo restante
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Não mostrar se não há force_logout_at ou foi dispensado
  if (!forceLogoutAt || dismissed || timeRemaining === null) {
    return null;
  }

  // Determinar cor baseado no tempo restante
  const isUrgent = timeRemaining < 60; // menos de 1 minuto
  const bgColor = isUrgent ? 'bg-destructive' : 'bg-amber-500';
  const textColor = 'text-white';

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${bgColor} ${textColor} shadow-lg`}>
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
              <span className="font-medium">
                {forceLogoutReason || 'Outra sessão foi iniciada'}
              </span>
              <span className="text-sm opacity-90">
                Esta sessão será encerrada em{' '}
                <span className="font-bold text-lg">{formatTime(timeRemaining)}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleForceLogout}
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              Sair agora
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="text-white hover:bg-white/20 h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
