import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Plus, Globe, Users, Calendar } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const AdminTenants = () => {
  const { data: organization, isLoading } = useOrganization();

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
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Tenant
          </Button>
        </div>

        {/* Tenants List */}
        <div className="space-y-4">
          {organization && (
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Building2 className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{organization.nome}</h3>
                      {organization.nome_plataforma && (
                        <p className="text-sm text-muted-foreground">
                          Plataforma: {organization.nome_plataforma}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        {organization.cidade && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3.5 w-3.5" />
                            {organization.cidade}{organization.estado ? `, ${organization.estado}` : ''}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Criado em {format(new Date(organization.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium bg-green-500/10 text-green-600 px-2 py-1 rounded-full">
                      Ativo
                    </span>
                    <Button variant="outline" size="sm">
                      Detalhes
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!organization && !isLoading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-medium text-lg mb-1">Nenhum tenant cadastrado</h3>
                <p className="text-muted-foreground text-sm">
                  Crie o primeiro tenant para começar.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminTenants;
