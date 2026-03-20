import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Monitor,
  Smartphone,
  Tablet,
  Loader2,
  LogOut,
  Clock,
  RefreshCw
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useActiveSessions, ActiveSession } from '@/hooks/useActiveSessions';
import { toast } from 'sonner';

const getDeviceIcon = (deviceInfo: string | null) => {
  if (!deviceInfo) return Monitor;
  const lower = deviceInfo.toLowerCase();
  if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) {
    return Smartphone;
  }
  if (lower.includes('tablet') || lower.includes('ipad')) {
    return Tablet;
  }
  return Monitor;
};

interface SessionItemProps {
  session: ActiveSession;
  onTerminate: (sessionId: string) => Promise<boolean>;
  isTerminating: boolean;
}

const SessionItem = ({ session, onTerminate, isTerminating }: SessionItemProps) => {
  const DeviceIcon = getDeviceIcon(session.device_info);
  const [terminating, setTerminating] = useState(false);

  const handleTerminate = async () => {
    setTerminating(true);
    const success = await onTerminate(session.session_id);
    if (success) {
      toast.success('Sessão encerrada com sucesso');
    } else {
      toast.error('Erro ao encerrar sessão');
    }
    setTerminating(false);
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-muted">
          <DeviceIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {session.browser || 'Navegador desconhecido'} no {session.os || 'Sistema desconhecido'}
            </span>
            {session.is_current && (
              <Badge variant="secondary" className="text-xs">
                Sessão Atual
              </Badge>
            )}
            {session.force_logout_at && !session.is_current && (
              <Badge variant="destructive" className="text-xs">
                Será encerrada
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Login: {format(new Date(session.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
            <span>
              Última atividade: {formatDistanceToNow(new Date(session.last_activity), {
                addSuffix: true,
                locale: ptBR
              })}
            </span>
          </div>
        </div>
      </div>

      {!session.is_current && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={terminating || isTerminating}
            >
              {terminating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Encerrar sessão?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação irá desconectar o dispositivo "{session.browser} no {session.os}".
                O usuário precisará fazer login novamente nesse dispositivo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleTerminate}>
                Encerrar sessão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export const ActiveSessionsCard = () => {
  const {
    sessions,
    isLoading,
    fetchSessions,
    terminateSession
  } = useActiveSessions();
  const [isTerminating, setIsTerminating] = useState(false);

  const handleTerminate = async (sessionId: string) => {
    setIsTerminating(true);
    const result = await terminateSession(sessionId);
    setIsTerminating(false);
    return result;
  };

  const handleRefresh = () => {
    fetchSessions();
    toast.success('Lista de sessões atualizada');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Sessões Ativas
            </CardTitle>
            <CardDescription>
              Dispositivos conectados à sua conta ({sessions.length} {sessions.length === 1 ? 'sessão' : 'sessões'})
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Monitor className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma sessão ativa encontrada</p>
          </div>
        ) : (
          sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              onTerminate={handleTerminate}
              isTerminating={isTerminating}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
};
