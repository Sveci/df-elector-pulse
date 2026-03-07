import { useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Plus, Globe, Calendar, Users, Mail, Phone, MoreVertical, CheckCircle, XCircle } from "lucide-react";
import { useTenants, useUpdateTenant } from "@/hooks/useTenants";
import { CreateTenantDialog } from "@/components/admin/CreateTenantDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const AdminTenants = () => {
  const { data: tenants, isLoading } = useTenants();
  const updateTenant = useUpdateTenant();
  const [createOpen, setCreateOpen] = useState(false);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      await updateTenant.mutateAsync({ id, status: newStatus });
      toast({ title: "Status atualizado", description: `Tenant ${newStatus === "active" ? "ativado" : "desativado"}.` });
    } catch {
      toast({ title: "Erro", description: "Não foi possível atualizar o status.", variant: "destructive" });
    }
  };

  const planoLabel: Record<string, { label: string; class: string }> = {
    basic: { label: "Básico", class: "bg-muted text-muted-foreground" },
    pro: { label: "Profissional", class: "bg-blue-500/10 text-blue-600" },
    premium: { label: "Premium", class: "bg-amber-500/10 text-amber-600" },
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestão de Tenants</h1>
            <p className="text-muted-foreground text-sm">
              Gerencie as organizações da plataforma
            </p>
          </div>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Novo Tenant
          </Button>
        </div>

        {/* Stats */}
        {tenants && tenants.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{tenants.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ativos</p>
                  <p className="text-xl font-bold">{tenants.filter((t) => t.status === "active").length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Inativos</p>
                  <p className="text-xl font-bold">{tenants.filter((t) => t.status !== "active").length}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tenants List */}
        <div className="space-y-3">
          {isLoading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}

          {tenants?.map((tenant) => {
            const plano = planoLabel[tenant.plano] || planoLabel.basic;
            return (
              <Card key={tenant.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="p-3 rounded-lg bg-primary/10 shrink-0">
                        <Building2 className="h-7 w-7 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg text-foreground">{tenant.nome}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${plano.class}`}>
                            {plano.label}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            tenant.status === "active"
                              ? "bg-green-500/10 text-green-600"
                              : "bg-red-500/10 text-red-600"
                          }`}>
                            {tenant.status === "active" ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">/{tenant.slug}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                          {tenant.email_contato && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5" />
                              {tenant.email_contato}
                            </span>
                          )}
                          {tenant.telefone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              {tenant.telefone}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(tenant.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            Máx {tenant.max_usuarios} usuários
                          </span>
                        </div>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleToggleStatus(tenant.id, tenant.status)}>
                          {tenant.status === "active" ? "Desativar" : "Ativar"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {!isLoading && (!tenants || tenants.length === 0) && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-medium text-lg mb-1">Nenhum tenant cadastrado</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Crie o primeiro tenant para começar.
                </p>
                <Button onClick={() => setCreateOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar Primeiro Tenant
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <CreateTenantDialog open={createOpen} onOpenChange={setCreateOpen} />
    </AdminLayout>
  );
};

export default AdminTenants;
