import { useEffect, useState } from "react";
import type { Node } from "@xyflow/react";
import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { NODE_CONFIG } from "./FlowNodes";
import type { FlowNodeData, FlowNodeType } from "@/hooks/useWhatsAppFlows";
import { AVAILABLE_DYNAMIC_FUNCTIONS } from "@/hooks/useWhatsAppFlows";

interface NodeConfigPanelProps {
  node: Node | null;
  onClose: () => void;
  onChange: (nodeId: string, data: Partial<FlowNodeData>) => void;
  onDelete: (nodeId: string) => void;
}

export function NodeConfigPanel({ node, onClose, onChange, onDelete }: NodeConfigPanelProps) {
  const [form, setForm] = useState<FlowNodeData>({} as FlowNodeData);

  useEffect(() => {
    if (node) setForm({ ...(node.data as FlowNodeData) });
  }, [node?.id]);

  if (!node) return null;

  const type = node.type as FlowNodeType;
  const cfg = NODE_CONFIG[type];
  const Icon = cfg.icon;

  const update = (field: string, value: unknown) => {
    const next = { ...form, [field]: value };
    setForm(next);
    onChange(node.id, { [field]: value });
  };

  const aliasesStr = (form.aliases || []).join(", ");

  return (
    <div className="h-full flex flex-col bg-background border-l w-[340px] flex-shrink-0 overflow-hidden">
      {/* Header */}
      <div className={`flex items-center gap-2 px-4 py-3 border-b ${cfg.bg} ${cfg.border}`}>
        <Icon className={`h-4 w-4 ${cfg.color}`} />
        <span className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</span>
        <span className="text-xs text-muted-foreground ml-1">— {cfg.description}</span>
        <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Common: Label */}
        <div className="space-y-1.5">
          <Label>Nome do nó</Label>
          <Input
            value={form.label || ""}
            onChange={(e) => update("label", e.target.value)}
            placeholder="Ex: Verificar cidade"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Descrição (opcional)</Label>
          <Input
            value={form.description || ""}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Breve descrição do nó"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label>Nó ativo</Label>
          <Switch
            checked={form.isActive !== false}
            onCheckedChange={(v) => update("isActive", v)}
          />
        </div>

        <Separator />

        {/* ─── TRIGGER ─── */}
        {type === "trigger" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tipo de gatilho</Label>
              <Select
                value={form.triggerType || "any_message"}
                onValueChange={(v) => update("triggerType", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any_message">Qualquer mensagem</SelectItem>
                  <SelectItem value="first_contact">Primeiro contato</SelectItem>
                  <SelectItem value="keyword">Palavra-chave específica</SelectItem>
                  <SelectItem value="schedule">Agendado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* ─── KEYWORD ─── */}
        {type === "keyword" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Palavra-chave principal</Label>
              <Input
                value={form.keyword || ""}
                onChange={(e) => update("keyword", e.target.value.toUpperCase())}
                placeholder="Ex: AJUDA"
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Será automaticamente convertida para maiúsculas.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Aliases (sinônimos)</Label>
              <Input
                value={aliasesStr}
                onChange={(e) =>
                  update(
                    "aliases",
                    e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
                  )
                }
                placeholder="HELP, SOCORRO, ?"
              />
              <p className="text-[11px] text-muted-foreground">Separe por vírgula.</p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Correspondência parcial</Label>
              <Switch
                checked={!!form.partialMatch}
                onCheckedChange={(v) => update("partialMatch", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Sensível a maiúsculas</Label>
              <Switch
                checked={!!form.caseSensitive}
                onCheckedChange={(v) => update("caseSensitive", v)}
              />
            </div>
          </div>
        )}

        {/* ─── MESSAGE ─── */}
        {type === "message" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Texto da mensagem</Label>
              <Textarea
                value={form.messageText || ""}
                onChange={(e) => update("messageText", e.target.value)}
                placeholder="Olá! Como posso ajudar?\n\n1️⃣ Opção A\n2️⃣ Opção B"
                rows={5}
              />
              <p className="text-[11px] text-muted-foreground">
                Suporta emojis e quebras de linha. Variáveis: {"{{nome}}"}, {"{{municipio}}"}.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de mídia (opcional)</Label>
              <Select
                value={form.mediaType || "none"}
                onValueChange={(v) => update("mediaType", v === "none" ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem mídia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem mídia</SelectItem>
                  <SelectItem value="image">🖼 Imagem</SelectItem>
                  <SelectItem value="video">🎬 Vídeo</SelectItem>
                  <SelectItem value="document">📄 Documento</SelectItem>
                  <SelectItem value="audio">🎵 Áudio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.mediaType && (
              <div className="space-y-1.5">
                <Label>URL da mídia</Label>
                <Input
                  value={form.mediaUrl || ""}
                  onChange={(e) => update("mediaUrl", e.target.value)}
                  placeholder="https://..."
                />
              </div>
            )}
          </div>
        )}

        {/* ─── AI RESPONSE ─── */}
        {type === "ai_response" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Prompt do sistema</Label>
              <Textarea
                value={form.aiPrompt || ""}
                onChange={(e) => update("aiPrompt", e.target.value)}
                placeholder="Você é um assistente virtual amigável. Responda de forma clara e concisa..."
                rows={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Modelo de IA</Label>
              <Select
                value={form.aiModel || "gpt-4o-mini"}
                onValueChange={(v) => update("aiModel", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini (rápido)</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o (avançado)</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (econômico)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Usar Base de Conhecimento</Label>
              <Switch
                checked={!!form.useKnowledgeBase}
                onCheckedChange={(v) => update("useKnowledgeBase", v)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Temperatura</Label>
                <span className="text-xs text-muted-foreground font-mono">
                  {(form.temperature ?? 0.7).toFixed(1)}
                </span>
              </div>
              <Slider
                value={[form.temperature ?? 0.7]}
                onValueChange={([v]) => update("temperature", v)}
                min={0}
                max={1}
                step={0.1}
              />
              <p className="text-[11px] text-muted-foreground">
                0 = preciso e determinístico · 1 = criativo e variado
              </p>
            </div>
          </div>
        )}

        {/* ─── AUTOMATION ─── */}
        {type === "automation" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Função a executar</Label>
              <Select
                value={form.automationFunction || ""}
                onValueChange={(v) => update("automationFunction", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma função" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_DYNAMIC_FUNCTIONS.map((fn) => (
                    <SelectItem key={fn.value} value={fn.value}>
                      <div className="flex flex-col">
                        <span>{fn.label}</span>
                        <span className="text-[10px] text-muted-foreground">{fn.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.automationFunction && (
              <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Esta função será executada e seu resultado enviado ao usuário como mensagem.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── CONDITION ─── */}
        {type === "condition" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Campo a verificar</Label>
              <Select
                value={form.conditionField || ""}
                onValueChange={(v) => update("conditionField", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o campo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="message">Mensagem recebida</SelectItem>
                  <SelectItem value="state">Estado da sessão</SelectItem>
                  <SelectItem value="municipio">Município</SelectItem>
                  <SelectItem value="registration_state">Status de cadastro</SelectItem>
                  <SelectItem value="already_registered">Já inscrito no evento</SelectItem>
                  <SelectItem value="invite_sent_count">Convites enviados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Operador</Label>
              <Select
                value={form.conditionOperator || "equals"}
                onValueChange={(v) => update("conditionOperator", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">É igual a</SelectItem>
                  <SelectItem value="contains">Contém</SelectItem>
                  <SelectItem value="starts_with">Começa com</SelectItem>
                  <SelectItem value="regex">Expressão regular</SelectItem>
                  <SelectItem value="is_empty">Está vazio</SelectItem>
                  <SelectItem value="is_not_empty">Não está vazio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!["is_empty", "is_not_empty"].includes(form.conditionOperator || "") && (
              <div className="space-y-1.5">
                <Label>Valor</Label>
                <Input
                  value={form.conditionValue || ""}
                  onChange={(e) => update("conditionValue", e.target.value)}
                  placeholder="Ex: registrado, São Paulo, 1"
                  className="font-mono"
                />
              </div>
            )}
            <div className="p-2 rounded-lg bg-orange-50 border border-orange-200 dark:bg-orange-950/20 dark:border-orange-800">
              <p className="text-[11px] text-orange-700 dark:text-orange-400">
                Conecte a saída <Badge className="bg-green-100 text-green-700 text-[10px] border-0 py-0">✓ Sim</Badge>{" "}
                e{" "}
                <Badge className="bg-red-100 text-red-700 text-[10px] border-0 py-0">✗ Não</Badge>{" "}
                a diferentes caminhos.
              </p>
            </div>
          </div>
        )}

        {/* ─── DELAY ─── */}
        {type === "delay" && (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Tempo de espera</Label>
                <span className="text-xs font-mono text-muted-foreground">
                  {(form.delaySeconds || 0) >= 60
                    ? `${Math.round((form.delaySeconds || 0) / 60)} min`
                    : `${form.delaySeconds || 0} seg`}
                </span>
              </div>
              <Slider
                value={[form.delaySeconds || 0]}
                onValueChange={([v]) => update("delaySeconds", v)}
                min={0}
                max={300}
                step={5}
              />
              <p className="text-[11px] text-muted-foreground">0 a 300 segundos (5 min máx.)</p>
            </div>
          </div>
        )}

        {/* ─── END ─── */}
        {type === "end" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Ação ao finalizar</Label>
              <Select
                value={form.endAction || "nothing"}
                onValueChange={(v) => update("endAction", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nothing">Aguardar próxima mensagem</SelectItem>
                  <SelectItem value="close">Encerrar conversa</SelectItem>
                  <SelectItem value="transfer_human">Transferir para atendimento humano</SelectItem>
                  <SelectItem value="restart">Reiniciar fluxo do início</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mensagem de encerramento (opcional)</Label>
              <Textarea
                value={form.endMessage || ""}
                onChange={(e) => update("endMessage", e.target.value)}
                placeholder="Até mais! Se precisar de algo, é só chamar. 😊"
                rows={3}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer: delete */}
      <div className="p-3 border-t">
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => onDelete(node.id)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Remover nó
        </Button>
      </div>
    </div>
  );
}
