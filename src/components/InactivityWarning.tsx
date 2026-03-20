import { Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';

export const InactivityWarning = () => {
  const { showWarning, secondsRemaining, continueSession } = useInactivityLogout();

  if (!showWarning) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isUrgent = secondsRemaining <= 30;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-right-5 fade-in duration-300">
      <Card className={`w-80 shadow-lg border-2 ${
        isUrgent
          ? 'border-destructive bg-destructive/10'
          : 'border-amber-500 bg-amber-500/10'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full ${
              isUrgent ? 'bg-destructive/20' : 'bg-amber-500/20'
            }`}>
              <Clock className={`h-5 w-5 ${
                isUrgent ? 'text-destructive' : 'text-amber-600'
              }`} />
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <h4 className="font-semibold text-sm">Sessão inativa</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Você será desconectado por inatividade em
                </p>
                <p className={`text-2xl font-bold mt-1 ${
                  isUrgent ? 'text-destructive' : 'text-amber-600'
                }`}>
                  {formatTime(secondsRemaining)}
                </p>
              </div>

              <Button
                onClick={continueSession}
                size="sm"
                className="w-full"
                variant={isUrgent ? "destructive" : "default"}
              >
                Continuar conectado
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
