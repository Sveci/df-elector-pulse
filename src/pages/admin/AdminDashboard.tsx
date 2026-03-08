import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Ticket, Users, Activity, Phone, CheckCircle2, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTicketStats } from "@/hooks/support/useAdminTickets";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SmsStatus {
  activeProvider: string;
  providers: {
    key: string;
    label: string;
    enabled: boolean;
    balance: number | null;
    balanceLoading: boolean;
    balanceError: string | null;
  }[];
}

const providerLabels: Record<string, string> = {
  smsdev: "SMSDEV",
  smsbarato: "SMSBarato",
  disparopro: "DisparoPro",
};

const AdminDashboard = () => {
  const { data: stats } = useTicketStats();
  const [smsStatus, setSmsStatus] = useState<SmsStatus | null>(null);
  const [isLoadingSms, setIsLoadingSms] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSmsStatus = async (showToast = false) => {
    try {
      const { data } = await supabase
        .from("integrations_settings")
        .select("sms_active_provider, smsdev_enabled, smsdev_api_key, smsbarato_enabled, smsbarato_api_key, disparopro_enabled, disparopro_token")
        .limit(1)
        .maybeSingle();

      if (!data) {
        setSmsStatus(null);
        return;
      }

      const providers = [
        {
          key: "smsdev",
          label: "SMSDEV",
          enabled: !!(data as any).smsdev_enabled,
          hasKey: !!(data as any).smsdev_api_key,
          balance: null as number | null,
          balanceLoading: false,
          balanceError: null as string | null,
        },
        {
          key: "smsbarato",
          label: "SMSBarato",
          enabled: !!(data as any).smsbarato_enabled,
          hasKey: !!(data as any).smsbarato_api_key,
          balance: null as number | null,
          balanceLoading: false,
          balanceError: null as string | null,
        },
        {
          key: "disparopro",
          label: "DisparoPro",
          enabled: !!(data as any).disparopro_enabled,
          hasKey: !!(data as any).disparopro_token,
          balance: null as number | null,
          balanceLoading: false,
          balanceError: null as string | null,
        },
      ];

      setSmsStatus({
        activeProvider: (data as any).sms_active_provider || "smsdev",
        providers,
      });

      // Fetch balances for enabled providers with keys
      for (const p of providers) {
        if (p.enabled && p.hasKey) {
          fetchBalance(p.key);
        }
      }

      if (showToast) toast.success("Status de SMS atualizado");
    } catch {
      toast.error("Erro ao carregar status de SMS");
    } finally {
      setIsLoadingSms(false);
      setIsRefreshing(false);
    }
  };

  const fetchBalance = async (providerKey: string) => {
    setSmsStatus(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        providers: prev.providers.map(p =>
          p.key === providerKey ? { ...p, balanceLoading: true, balanceError: null } : p
        ),
      };
    });

    try {
      const { data, error } = await supabase.functions.invoke("test-api-connection", {
        body: { provider: providerKey },
      });

      if (error) throw error;

      setSmsStatus(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          providers: prev.providers.map(p =>
            p.key === providerKey
              ? {
                  ...p,
                  balanceLoading: false,
                  balance: data?.success ? (data.data?.balance ?? null) : null,
                  balanceError: data?.success ? null : (data?.error || "Erro"),
                }
              : p
          ),
        };
      });
    } catch (err: any) {
      setSmsStatus(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          providers: prev.providers.map(p =>
            p.key === providerKey
              ? { ...p, balanceLoading: false, balanceError: err.message || "Erro" }
              : p
          ),
        };
      });
    }
  };

  useEffect(() => {
    fetchSmsStatus();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchSmsStatus(true);
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
          <p className="text-muted-foreground text-sm">
            Visão geral da plataforma multitenant
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tenants</p>
                  <p className="text-2xl font-bold">1</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Usuários Totais</p>
                  <p className="text-2xl font-bold">—</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-amber-500/10">
                  <Ticket className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tickets Abertos</p>
                  <p className="text-2xl font-bold">{stats?.abertos ?? '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <Activity className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sistema</p>
                  <p className="text-2xl font-bold text-green-600">Online</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SMS Provider Status Card */}
        <Card className="mb-8">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Phone className="h-5 w-5 text-blue-500" />
                </div>
                Provedores de SMS
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="gap-1.5"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingSms ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Carregando status dos provedores...</span>
              </div>
            ) : !smsStatus ? (
              <p className="text-sm text-muted-foreground">Nenhuma configuração de SMS encontrada.</p>
            ) : (
              <div className="space-y-4">
                {/* Active provider highlight */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Provedor principal ativo:</span>
                  <Badge variant="default" className="text-xs">
                    {providerLabels[smsStatus.activeProvider] || smsStatus.activeProvider}
                  </Badge>
                </div>

                {/* Provider list */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {smsStatus.providers.map((provider) => {
                    const isActive = provider.key === smsStatus.activeProvider;
                    return (
                      <div
                        key={provider.key}
                        className={`p-4 rounded-lg border transition-colors ${
                          isActive
                            ? "border-primary bg-primary/5"
                            : provider.enabled
                            ? "border-border"
                            : "border-border opacity-50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-foreground text-sm">{provider.label}</span>
                          <div className="flex items-center gap-1.5">
                            {isActive && (
                              <Badge variant="default" className="text-[10px] px-1.5 py-0">
                                Principal
                              </Badge>
                            )}
                            {provider.enabled ? (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                                Inativo
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Balance */}
                        {provider.enabled && (
                          <div className="mt-2">
                            {provider.balanceLoading ? (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span className="text-xs">Consultando saldo...</span>
                              </div>
                            ) : provider.balanceError ? (
                              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                <AlertCircle className="h-3 w-3" />
                                <span className="text-xs">{provider.balanceError}</span>
                              </div>
                            ) : provider.balance !== null ? (
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                <span className="text-sm font-semibold text-foreground">
                                  {provider.balance.toLocaleString("pt-BR")} SMS
                                </span>
                                <span className="text-xs text-muted-foreground">disponíveis</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sem dados de saldo</span>
                            )}
                          </div>
                        )}

                        {!provider.enabled && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Ative em <a href="/admin/apis" className="text-primary hover:underline">APIs Externas</a>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs text-muted-foreground">
                  Gerencie provedores e chaves em{" "}
                  <a href="/admin/apis" className="text-primary hover:underline">APIs Externas →</a>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tickets Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {stats ? `${stats.abertos + stats.em_analise} tickets pendentes de ação` : 'Carregando...'}
              </p>
              <a href="/admin/tickets" className="text-sm text-primary hover:underline mt-2 inline-block">
                Ver todos os tickets →
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Gestão de Tenants</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Gerencie organizações e seus acessos à plataforma
              </p>
              <a href="/admin/tenants" className="text-sm text-primary hover:underline mt-2 inline-block">
                Gerenciar tenants →
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
