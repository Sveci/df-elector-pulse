import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";
import {
  WhatsAppTemplate,
  replaceTemplateVariables,
} from "@/hooks/useWhatsAppTemplates";

interface WhatsAppTestSendDialogProps {
  template: WhatsAppTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhatsAppTestSendDialog({
  template,
  open,
  onOpenChange,
}: WhatsAppTestSendDialogProps) {
  const [phone, setPhone] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (template) {
      // Initialize variables with placeholder values
      const initialVars: Record<string, string> = {};
      template.variaveis.forEach((v) => {
        initialVars[v] = `[${v}]`;
      });
      setVariables(initialVars);
    }
  }, [template]);

  const handleSend = async () => {
    if (!template || !phone) return;

    setIsSending(true);
    try {
      const message = replaceTemplateVariables(template.mensagem, variables);

      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          phone,
          message,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Mensagem de teste enviada!");
        onOpenChange(false);
        setPhone("");
      } else {
        throw new Error(data?.error || "Erro ao enviar mensagem");
      }
    } catch (error: any) {
      console.error("Erro ao enviar teste:", error);
      toast.error(error.message || "Erro ao enviar mensagem de teste");
    } finally {
      setIsSending(false);
    }
  };

  const previewMessage = template
    ? replaceTemplateVariables(template.mensagem, variables)
    : "";

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar Mensagem de Teste</DialogTitle>
          <DialogDescription>
            Envie uma mensagem de teste para verificar o template.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">WhatsApp de Destino</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="61999999999"
            />
            <p className="text-xs text-muted-foreground">
              Digite apenas números com DDD
            </p>
          </div>

          {template.variaveis.length > 0 && (
            <div className="space-y-3">
              <Label>Variáveis</Label>
              {template.variaveis.map((v) => (
                <div key={v} className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-32 truncate">
                    {`{{${v}}}`}
                  </span>
                  <Input
                    value={variables[v] || ""}
                    onChange={(e) =>
                      setVariables({ ...variables, [v]: e.target.value })
                    }
                    placeholder={`Valor para ${v}`}
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border p-4 bg-muted/50">
            <Label className="text-sm font-medium">Pré-visualização</Label>
            <div className="mt-2 p-3 bg-background rounded-lg whitespace-pre-wrap text-sm">
              {previewMessage}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={isSending || !phone}>
            {isSending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Enviar Teste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
