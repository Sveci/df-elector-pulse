import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2, CheckCircle, Globe, Settings } from "lucide-react";
import { useTenantContext } from "@/contexts/TenantContext";
import { useTenants, Tenant } from "@/hooks/useTenants";
import { useNavigate } from "react-router-dom";

export function TenantSelectorModal() {
  const { showTenantSelector, setShowTenantSelector, setActiveTenant, activeTenant, isSuperAdmin } = useTenantContext();
  const { data: allTenants, isLoading } = useTenants();
  const navigate = useNavigate();

  // Super admin vê todos os tenants
  const tenants = isSuperAdmin ? allTenants : [];

  const handleSelect = (tenant: Tenant) => {
    setActiveTenant(tenant);
    setShowTenantSelector(false);
    navigate("/dashboard");
  };

  const handleAdminPanel = () => {
    // Limpa tenant ativo em memória, mas mantém no localStorage para restaurar ao voltar
    setActiveTenant(null, false);
    setShowTenantSelector(false);
    navigate("/admin");
  };

  return (
    <Dialog open={showTenantSelector} onOpenChange={setShowTenantSelector}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Selecionar Conta
          </DialogTitle>
          <DialogDescription>
            Escolha em qual conta você deseja acessar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-4 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : tenants && tenants.length > 0 ? (
            <>
              {tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => handleSelect(tenant)}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-all text-left hover:bg-accent/50 ${
                    activeTenant?.id === tenant.id
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{tenant.nome}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {tenant.email_contato && (
                        <span className="text-xs text-muted-foreground truncate">
                          {tenant.email_contato}
                        </span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        tenant.plano === 'premium'
                          ? 'bg-amber-500/10 text-amber-600'
                          : tenant.plano === 'pro'
                          ? 'bg-blue-500/10 text-blue-600'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {tenant.plano}
                      </span>
                    </div>
                  </div>
                  {activeTenant?.id === tenant.id && (
                    <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                  )}
                </button>
              ))}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Nenhuma conta disponível</p>
            </div>
          )}
        </div>

        {isSuperAdmin && (
          <div className="pt-4 border-t border-border">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleAdminPanel}
            >
              <Settings className="h-4 w-4" />
              Acessar Painel Administrativo
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
