import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTenant } from "@/hooks/useTenants";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface CreateTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTenantDialog({ open, onOpenChange }: CreateTenantDialogProps) {
  const createTenant = useCreateTenant();

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
  });

  const generateSlug = (nome: string) => {
    return nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleNomeChange = (nome: string) => {
    setForm((prev) => ({
      ...prev,
      nome,
      slug: generateSlug(nome),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.nome.trim() || !form.slug.trim()) {
      toast({ title: "Erro", description: "Nome e slug são obrigatórios.", variant: "destructive" });
      return;
    }

    try {
      await createTenant.mutateAsync({
        nome: form.nome.trim(),
        slug: form.slug.trim(),
        email_contato: form.email_contato || undefined,
        telefone: form.telefone || undefined,
        plano: form.plano,
        max_usuarios: form.max_usuarios,
        max_contatos: form.max_contatos,
        max_lideres: form.max_lideres,
        observacoes: form.observacoes || undefined,
      });

      toast({ title: "Tenant criado!", description: `${form.nome} foi cadastrado com sucesso.` });
      onOpenChange(false);
      setForm({
        nome: "",
        slug: "",
        email_contato: "",
        telefone: "",
        plano: "basic",
        max_usuarios: 5,
        max_contatos: 10000,
        max_lideres: 500,
        observacoes: "",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao criar tenant",
        description: error.message?.includes("duplicate")
          ? "Já existe um tenant com esse slug."
          : error.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Tenant</DialogTitle>
          <DialogDescription>
            Cadastre uma nova organização na plataforma
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nome">Nome da Organização *</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => handleNomeChange(e.target.value)}
                placeholder="Ex: Prefeitura de São Paulo"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="slug">Slug (identificador único) *</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                placeholder="prefeitura-sp"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email de Contato</Label>
              <Input
                id="email"
                type="email"
                value={form.email_contato}
                onChange={(e) => setForm((p) => ({ ...p, email_contato: e.target.value }))}
                placeholder="contato@org.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={form.telefone}
                onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={form.plano} onValueChange={(v) => setForm((p) => ({ ...p, plano: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Básico</SelectItem>
                  <SelectItem value="pro">Profissional</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_usuarios">Máx. Usuários</Label>
              <Input
                id="max_usuarios"
                type="number"
                value={form.max_usuarios}
                onChange={(e) => setForm((p) => ({ ...p, max_usuarios: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_contatos">Máx. Contatos</Label>
              <Input
                id="max_contatos"
                type="number"
                value={form.max_contatos}
                onChange={(e) => setForm((p) => ({ ...p, max_contatos: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_lideres">Máx. Lideranças</Label>
              <Input
                id="max_lideres"
                type="number"
                value={form.max_lideres}
                onChange={(e) => setForm((p) => ({ ...p, max_lideres: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={form.observacoes}
                onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
                placeholder="Notas internas sobre o tenant..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createTenant.isPending}>
              {createTenant.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Tenant
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
