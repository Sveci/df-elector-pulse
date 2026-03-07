import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Ticket, Users, Activity } from "lucide-react";
import { useAllTickets, useTicketStats } from "@/hooks/support/useAdminTickets";

const AdminDashboard = () => {
  const { data: stats } = useTicketStats();

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
