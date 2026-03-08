import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateTenant, Tenant } from "@/hooks/useTenants";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { CARGOS_POLITICOS, ESTADOS_BR, getCargoConfig } from "@/constants/brazilPolitics";
import { useBrazilCities } from "@/hooks/useBrazilCities";
import { useOfficeCities } from "@/hooks/office/useOfficeCities";

interface EditTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant | null;
}

export function EditTenantDialog({ open, onOpenChange, tenant }: EditTenantDialogProps) {
  const updateTenant = useUpdateTenant();

  const [form, setForm] = useState({
    nome: "",
    slug: "",
    email_contato: "",
    telefone: "",
    plano: "basic",
    max_usuarios: 5,
    max_contatos: 10000,
    max_lideres: 500,
    observacoes: "",
    cargo_politico: "",
    estado: "",
    cidade: "",
    regiao_administrativa_id: "",
    custom_domain: "",
  });

  useEffect(() => {
    if (tenant) {
      setForm({
        nome: tenant.nome || "",
        slug: tenant.slug || "",
        email_contato: tenant.email_contato || "",
        telefone: tenant.telefone || "",
        plano: tenant.plano || "basic",
        max_usuarios: tenant.max_usuarios || 5,
        max_contatos: tenant.max_contatos || 10000,
        max_lideres: tenant.max_lideres || 500,
        observacoes: tenant.observacoes || "",
        cargo_politico: tenant.cargo_politico || "",
        estado: tenant.estado || "",
        cidade: tenant.cidade || "",
        regiao_administrativa_id: tenant.regiao_administrativa_id || "",
        custom_domain: tenant.custom_domain || "",
      });
    }
  }, [tenant]);

  const cargoConfig = getCargoConfig(form.cargo_politico);
  const isDF = form.estado === "DF";
  const showEstado = cargoConfig?.requiresEstado ?? false;
  const showCidade = cargoConfig?.requiresCidade ?? false;
  const showRA = (cargoConfig?.requiresRA && isDF) ?? false;

  const { data: ibgeCities, isLoading: loadingCities } = useBrazilCities(
    showCidade && form.estado ? form.estado : undefined
  );

  const { data: officeCities } = useOfficeCities();
  const raCities = officeCities?.filter(c => c.tipo === "DF") || [];

  const handleCargoChange = (cargo: string) => {
    const config = getCargoConfig(cargo);
    setForm(prev => ({
      ...prev,
      cargo_politico: cargo,
      estado: config?.requiresEstado ? prev.estado : "",
      cidade: config?.requiresCidade ? prev.cidade : "",
      regiao_administrativa_id: config?.requiresRA ? prev.regiao_administrativa_id : "",
    }));
  };

  const handleEstadoChange = (estado: string) => {
    setForm(prev => ({
      ...prev,
      estado,
      cidade: "",
      regiao_administrativa_id: "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    if (!form.nome.trim() || !form.slug.trim()) {
      toast({ title: "Erro", description: "Nome e slug são obrigatórios.", variant: "destructive" });
      return;
    }

    try {
      await updateTenant.mutateAsync({
        id: tenant.id,
        nome: form.nome.trim(),
        slug: form.slug.trim(),
        email_contato: form.email_contato || null,
        telefone: form.telefone || null,
        plano: form.plano,
        max_usuarios: form.max_usuarios,
        max_contatos: form.max_contatos,
        max_lideres: form.max_lideres,
        observacoes: form.observacoes || null,
        cargo_politico: form.cargo_politico || null,
        estado: form.estado || null,
        cidade: form.cidade || null,
        regiao_administrativa_id: form.regiao_administrativa_id || null,
        custom_domain: form.custom_domain?.trim() || null,
      });

      toast({ title: "Tenant atualizado!", description: `${form.nome} foi salvo com sucesso.` });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar tenant",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Tenant</DialogTitle>
          <DialogDescription>Atualize as informações da organização</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nome */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-nome">Nome da Organização *</Label>
              <Input id="edit-nome" value={form.nome} onChange={(e) => setForm(p => ({ ...p, nome: e.target.value }))} />
            </div>

            {/* Slug */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-slug">Slug *</Label>
              <Input id="edit-slug" value={form.slug} onChange={(e) => setForm(p => ({ ...p, slug: e.target.value }))} />
            </div>

            {/* Cargo Político */}
            <div className="space-y-2 sm:col-span-2">
              <Label>Cargo Político</Label>
              <Select value={form.cargo_politico} onValueChange={handleCargoChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  {CARGOS_POLITICOS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estado */}
            {showEstado && (
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={form.estado} onValueChange={handleEstadoChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_BR.map(e => (
                      <SelectItem key={e.uf} value={e.uf}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Cidade (IBGE) */}
            {showCidade && form.estado && !isDF && (
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Select value={form.cidade} onValueChange={(v) => setForm(p => ({ ...p, cidade: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingCities ? "Carregando..." : "Selecione a cidade"} />
                  </SelectTrigger>
                  <SelectContent>
                    {ibgeCities?.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Região Administrativa (DF) */}
            {showRA && isDF && (
              <div className="space-y-2">
                <Label>Região Administrativa</Label>
                <Select value={form.regiao_administrativa_id} onValueChange={(v) => setForm(p => ({ ...p, regiao_administrativa_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a RA" />
                  </SelectTrigger>
                  <SelectContent>
                    {raCities.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Domínio Customizado */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-custom-domain">Domínio Customizado</Label>
              <Input id="edit-custom-domain" value={form.custom_domain} onChange={(e) => setForm(p => ({ ...p, custom_domain: e.target.value }))} placeholder="https://app.politico.com.br" />
              <p className="text-xs text-muted-foreground">URL base usada nos links públicos (indicações, eventos, formulários)</p>
              
              {form.custom_domain && (
                <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border text-xs space-y-2">
                  <p className="font-semibold text-foreground">📋 Configuração DNS necessária:</p>
                  <p className="text-muted-foreground">
                    O tenant deve criar o seguinte registro no provedor de DNS do domínio:
                  </p>
                  <div className="bg-background rounded p-2 font-mono text-[11px] space-y-1">
                    <div className="flex gap-2">
                      <span className="text-primary font-semibold">Tipo:</span>
                      <span>CNAME</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-primary font-semibold">Nome:</span>
                      <span>{(() => {
                        try {
                          const url = form.custom_domain.startsWith("http") 
                            ? form.custom_domain 
                            : `https://${form.custom_domain}`;
                          return new URL(url).hostname;
                        } catch {
                          return form.custom_domain.replace(/https?:\/\//, "").split("/")[0];
                        }
                      })()}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-primary font-semibold">Destino:</span>
                      <span>app.eleitor360.ai</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground">
                    ⚠️ Caso use Cloudflare, ative o proxy (nuvem laranja) e configure SSL como <strong>Full</strong>.
                    Para outros provedores, o domínio também precisa ser adicionado em <strong>Settings → Domains</strong> do projeto Lovable.
                  </p>
                </div>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email de Contato</Label>
              <Input id="edit-email" type="email" value={form.email_contato} onChange={(e) => setForm(p => ({ ...p, email_contato: e.target.value }))} />
            </div>

            {/* Telefone */}
            <div className="space-y-2">
              <Label htmlFor="edit-telefone">Telefone</Label>
              <Input id="edit-telefone" value={form.telefone} onChange={(e) => setForm(p => ({ ...p, telefone: e.target.value }))} />
            </div>

            {/* Plano */}
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={form.plano} onValueChange={(v) => setForm(p => ({ ...p, plano: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Básico</SelectItem>
                  <SelectItem value="pro">Profissional</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Limites */}
            <div className="space-y-2">
              <Label htmlFor="edit-max-usuarios">Máx. Usuários</Label>
              <Input id="edit-max-usuarios" type="number" value={form.max_usuarios} onChange={(e) => setForm(p => ({ ...p, max_usuarios: Number(e.target.value) }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-max-contatos">Máx. Contatos</Label>
              <Input id="edit-max-contatos" type="number" value={form.max_contatos} onChange={(e) => setForm(p => ({ ...p, max_contatos: Number(e.target.value) }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-max-lideres">Máx. Lideranças</Label>
              <Input id="edit-max-lideres" type="number" value={form.max_lideres} onChange={(e) => setForm(p => ({ ...p, max_lideres: Number(e.target.value) }))} />
            </div>

            {/* Observações */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-observacoes">Observações</Label>
              <Textarea id="edit-observacoes" value={form.observacoes} onChange={(e) => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={3} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={updateTenant.isPending}>
              {updateTenant.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Alterações
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
