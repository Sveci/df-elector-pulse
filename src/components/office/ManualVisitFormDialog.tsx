import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ManualVisitFormDialogProps {
  visit: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualVisitFormDialog({ visit, open, onOpenChange }: ManualVisitFormDialogProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    endereco: "",
    data_nascimento: "",
    aceita_reuniao: false,
    continua_projeto: true,
    instagram: "",
    facebook: "",
    observacoes: "",
    tema_id: "",
    segue_instagram: false,
  });

  const { data: temas = [] } = useQuery({
    queryKey: ["temas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("temas" as any)
        .select("id, tema")
        .eq("is_active", true)
        .order("tema");
      return (data || []) as { id: string; tema: string }[];
    },
  });

  // Load existing form data if any
  useEffect(() => {
    if (open && visit?.id) {
      supabase
        .from("office_visit_forms")
        .select("*")
        .eq("visit_id", visit.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setForm({
              endereco: data.endereco || "",
              data_nascimento: data.data_nascimento || "",
              aceita_reuniao: data.aceita_reuniao || false,
              continua_projeto: data.continua_projeto ?? true,
              instagram: data.instagram || "",
              facebook: data.facebook || "",
              observacoes: data.observacoes || "",
              tema_id: data.tema_id || "",
              segue_instagram: (data as any).segue_instagram || false,
            });
          }
        });
    }
  }, [open, visit?.id]);

  if (!visit) return null;

  const handleSave = async () => {
    if (!form.endereco.trim()) {
      toast.error("Endereço é obrigatório");
      return;
    }
    if (!form.data_nascimento) {
      toast.error("Data de nascimento é obrigatória");
      return;
    }

    setSaving(true);
    try {
      // Upsert form data
      const { error: formError } = await supabase
        .from("office_visit_forms")
        .upsert({
          visit_id: visit.id,
          endereco: form.endereco,
          data_nascimento: form.data_nascimento,
          aceita_reuniao: form.aceita_reuniao,
          continua_projeto: form.continua_projeto,
          instagram: form.instagram || null,
          facebook: form.facebook || null,
          observacoes: form.observacoes || null,
          tema_id: form.tema_id || null,
          segue_instagram: form.segue_instagram,
          instagram_check_status: form.segue_instagram ? "confirmed" : "pending",
          submitted_at: new Date().toISOString(),
        }, { onConflict: "visit_id" });

      if (formError) throw formError;

      // Update visit status to FORM_SUBMITTED
      const { error: visitError } = await supabase
        .from("office_visits")
        .update({ status: "FORM_SUBMITTED" })
        .eq("id", visit.id);

      if (visitError) throw visitError;

      // Update contact data
      const updateData: any = {};
      if (form.endereco) updateData.endereco = form.endereco;
      if (form.data_nascimento) updateData.data_nascimento = form.data_nascimento;
      if (form.instagram) updateData.instagram = form.instagram;
      if (form.facebook) updateData.facebook = form.facebook;

      if (Object.keys(updateData).length > 0 && visit.contact_id) {
        await supabase
          .from("office_contacts")
          .update(updateData)
          .eq("id", visit.contact_id);
      }

      queryClient.invalidateQueries({ queryKey: ["office_visits"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled_visits"] });
      toast.success("Formulário preenchido com sucesso!");
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error saving manual form:", err);
      toast.error("Erro ao salvar formulário: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preencher Ficha Cadastral</DialogTitle>
          <DialogDescription>
            Preenchimento manual da ficha de visita - {visit.contact?.nome || "Visitante"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="endereco">Endereço *</Label>
            <Input
              id="endereco"
              value={form.endereco}
              onChange={(e) => setForm(f => ({ ...f, endereco: e.target.value }))}
              placeholder="Endereço completo"
            />
          </div>

          <div>
            <Label htmlFor="data_nascimento">Data de Nascimento *</Label>
            <Input
              id="data_nascimento"
              type="date"
              value={form.data_nascimento}
              onChange={(e) => setForm(f => ({ ...f, data_nascimento: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="tema">Pauta / Tema</Label>
            <Select value={form.tema_id} onValueChange={(v) => setForm(f => ({ ...f, tema_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tema" />
              </SelectTrigger>
              <SelectContent>
                {temas.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.tema}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="aceita_reuniao" className="text-sm">Aceita Reunião</Label>
              <Switch
                id="aceita_reuniao"
                checked={form.aceita_reuniao}
                onCheckedChange={(c) => setForm(f => ({ ...f, aceita_reuniao: c }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="continua_projeto" className="text-sm">Continua no Projeto</Label>
              <Switch
                id="continua_projeto"
                checked={form.continua_projeto}
                onCheckedChange={(c) => setForm(f => ({ ...f, continua_projeto: c }))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="instagram">Instagram</Label>
            <Input
              id="instagram"
              value={form.instagram}
              onChange={(e) => setForm(f => ({ ...f, instagram: e.target.value }))}
              placeholder="@usuario"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="segue_instagram" className="text-sm">
              Segue @rafaelprudentedep no Instagram
            </Label>
            <Switch
              id="segue_instagram"
              checked={form.segue_instagram}
              onCheckedChange={(c) => setForm(f => ({ ...f, segue_instagram: c }))}
            />
          </div>

          <div>
            <Label htmlFor="facebook">Facebook</Label>
            <Input
              id="facebook"
              value={form.facebook}
              onChange={(e) => setForm(f => ({ ...f, facebook: e.target.value }))}
              placeholder="Nome ou link do perfil"
            />
          </div>

          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={form.observacoes}
              onChange={(e) => setForm(f => ({ ...f, observacoes: e.target.value }))}
              placeholder="Observações adicionais..."
              className="min-h-[80px]"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="flex-1" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Formulário"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
