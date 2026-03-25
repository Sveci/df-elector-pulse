import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GrupoZapiSelector } from "./GrupoZapiSelector";
import { AlertaConfig, AlertaConfigInput, useCreateAlerta, useUpdateAlerta } from "@/hooks/proposicoes/useAlertasConfig";
import { Smartphone, Users, Zap, Cloud } from "lucide-react";

interface AlertasConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAlerta?: AlertaConfig | null;
}

const emptyForm: AlertaConfigInput = {
  nome: "",
  provider: "zapi",
  tipo_destino: "individual",
  destino: "",
  destino_nome: null,
  eventos_criticos_only: true,
  ativo: true,
};

export function AlertasConfigModal({
  open,
  onOpenChange,
  editingAlerta,
}: AlertasConfigModalProps) {
  const [form, setForm] = useState<AlertaConfigInput>(emptyForm);
  const createAlerta = useCreateAlerta();
  const updateAlerta = useUpdateAlerta();

  const isEditing = !!editingAlerta;
  const isPending = createAlerta.isPending || updateAlerta.isPending;

  useEffect(() => {
    if (editingAlerta) {
      setForm({
        nome: editingAlerta.nome,
        provider: editingAlerta.provider,
        tipo_destino: editingAlerta.tipo_destino,
        destino: editingAlerta.destino,
        destino_nome: editingAlerta.destino_nome,
        eventos_criticos_only: editingAlerta.eventos_criticos_only,
        ativo: editingAlerta.ativo,
      });
    } else {
      setForm(emptyForm);
    }
  }, [editingAlerta, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.destino) return;

    if (isEditing) {
      updateAlerta.mutate(
        { id: editingAlerta!.id, ...form },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createAlerta.mutate(form, { onSuccess: () => onOpenChange(false) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar alerta" : "Novo alerta de tramitação"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="nome-alerta">Nome do alerta *</Label>
            <Input
              id="nome-alerta"
              placeholder="Ex: Grupo Gabinete, Assessor João..."
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              required
            />
          </div>

          {/* Provider */}
          <div className="space-y-1.5">
            <Label>Provedor WhatsApp *</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    provider: "zapi",
                    tipo_destino: "individual",
                    destino: "",
                    destino_nome: null,
                  }))
                }
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  form.provider === "zapi"
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-muted text-muted-foreground hover:border-primary/40"
                }`}
              >
                <Zap className="h-4 w-4" />
                Z-API
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    provider: "meta_cloud",
                    tipo_destino: "individual",
                    destino: "",
                    destino_nome: null,
                  }))
                }
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  form.provider === "meta_cloud"
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-muted text-muted-foreground hover:border-primary/40"
                }`}
              >
                <Cloud className="h-4 w-4" />
                Meta Cloud
              </button>
            </div>
          </div>

          {/* Tipo de destino — grupos só disponíveis para Z-API */}
          <div className="space-y-1.5">
            <Label>Tipo de destino *</Label>
            <Select
              value={form.tipo_destino}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  tipo_destino: v as "individual" | "grupo_zapi",
                  destino: "",
                  destino_nome: null,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-3.5 w-3.5" />
                    Número individual
                  </div>
                </SelectItem>
                {form.provider === "zapi" && (
                  <SelectItem value="grupo_zapi">
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" />
                      Grupo WhatsApp (Z-API)
                    </div>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {form.provider === "meta_cloud" && (
              <p className="text-xs text-muted-foreground">
                Meta Cloud API não suporta envio para grupos.
              </p>
            )}
          </div>

          {/* Destino */}
          <div className="space-y-1.5">
            <Label>Destino *</Label>
            {form.tipo_destino === "grupo_zapi" ? (
              <GrupoZapiSelector
                value={form.destino}
                onChange={(id, name) =>
                  setForm((f) => ({ ...f, destino: id, destino_nome: name }))
                }
              />
            ) : (
              <div className="space-y-1">
                <Input
                  placeholder="+5561999999999"
                  value={form.destino}
                  onChange={(e) => setForm((f) => ({ ...f, destino: e.target.value }))}
                  type="tel"
                  inputMode="tel"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Formato: +55 DDD número (ex: +5561999990000)
                </p>
              </div>
            )}
          </div>

          {/* Filtro de eventos */}
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Apenas eventos críticos</p>
              <p className="text-xs text-muted-foreground">
                Votações, aprovações, arquivamentos, remessa ao Senado, etc.
              </p>
            </div>
            <Switch
              checked={form.eventos_criticos_only}
              onCheckedChange={(v) =>
                setForm((f) => ({ ...f, eventos_criticos_only: v }))
              }
            />
          </div>

          {!form.eventos_criticos_only && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              ⚠️ Modo "todos os eventos" pode gerar muitas mensagens para proposições ativas.
              Use com cautela.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !form.nome || !form.destino}>
              {isPending ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar alerta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
