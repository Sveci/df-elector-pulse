import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSurvey, type Survey } from "@/hooks/surveys/useSurveys";
import { Loader2 } from "lucide-react";

interface CreateSurveyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (survey: Survey) => void;
}

export function CreateSurveyDialog({ open, onOpenChange, onSuccess }: CreateSurveyDialogProps) {
  const createSurvey = useCreateSurvey();

  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    data_inicio: "",
    data_fim: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await createSurvey.mutateAsync({
      titulo: formData.titulo,
      descricao: formData.descricao || undefined,
      data_inicio: formData.data_inicio || undefined,
      data_fim: formData.data_fim || undefined,
    });

    setFormData({ titulo: "", descricao: "", data_inicio: "", data_fim: "" });
    onOpenChange(false);
    onSuccess?.(result);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nova Pesquisa Eleitoral</DialogTitle>
            <DialogDescription>
              Crie uma nova pesquisa de opinião. Você poderá adicionar perguntas em seguida.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título da Pesquisa *</Label>
              <Input
                id="titulo"
                placeholder="Ex: Pesquisa de Intenção de Voto 2024"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                placeholder="Breve descrição sobre o objetivo da pesquisa..."
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data_inicio">Data Início</Label>
                <Input
                  id="data_inicio"
                  type="date"
                  value={formData.data_inicio}
                  onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_fim">Data Fim</Label>
                <Input
                  id="data_fim"
                  type="date"
                  value={formData.data_fim}
                  onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!formData.titulo || createSurvey.isPending}>
              {createSurvey.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Pesquisa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
