import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { LocationSelect } from "@/components/office/LocationSelect";
import { useTenantLocationConfig } from "@/hooks/useTenantLocationConfig";
import { LeaderAutocomplete } from "@/components/office/LeaderAutocomplete";
import { useUpdateContact } from "@/hooks/contacts/useUpdateContact";
import { usePromoteToLeader } from "@/hooks/contacts/usePromoteToLeader";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Crown, UserCheck } from "lucide-react";
import {
  MaskedDateInput,
  formatDateBR,
  parseDateBR,
  isValidDateBR,
  isNotFutureDate
} from "@/components/ui/masked-date-input";

interface EditContactDialogProps {
  contact: {
    id: string;
    nome: string;
    telefone_norm: string;
    cidade_id: string;
    source_type: string | null;
    source_id: string | null;
    genero?: string;
    email?: string | null;
    data_nascimento?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditContactDialog({ contact, open, onOpenChange }: EditContactDialogProps) {
  const [cidadeId, setCidadeId] = useState(contact.cidade_id);
  const [localidade, setLocalidade] = useState("");
  const [leaderId, setLeaderId] = useState(contact.source_id || "");
  const [genero, setGenero] = useState(contact.genero || "Não identificado");
  const [dataNascimento, setDataNascimento] = useState(contact.data_nascimento || "");
  const [dataNascimentoDisplay, setDataNascimentoDisplay] = useState(
    contact.data_nascimento ? formatDateBR(contact.data_nascimento) : ""
  );
  const [promoteToLeader, setPromoteToLeader] = useState(false);
  const locationConfig = useTenantLocationConfig();

  const updateContact = useUpdateContact();
  const promoteToLeaderMutation = usePromoteToLeader();
  const { user } = useAuth();

  // Verificar se contato já é líder (por telefone) - busca server-side
  const { data: existingLeader } = useQuery({
    queryKey: ["leader_by_phone", contact.telefone_norm],
    queryFn: async () => {
      const normalizedPhone = contact.telefone_norm.replace(/\D/g, '').slice(-11);
      const { data } = await supabase
        .from("lideres")
        .select("id")
        .ilike("telefone", `%${normalizedPhone}`)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    enabled: !!contact.telefone_norm
  });

  const isAlreadyLeader = !!existingLeader;

  // Reset state when contact changes
  useEffect(() => {
    setCidadeId(contact.cidade_id);
    // LeaderAutocomplete faz lookup separado do líder pelo ID
    // então podemos usar source_id diretamente
    setLeaderId(contact.source_id || "");
    setGenero(contact.genero || "Não identificado");
    setDataNascimento(contact.data_nascimento || "");
    setDataNascimentoDisplay(contact.data_nascimento ? formatDateBR(contact.data_nascimento) : "");
    setPromoteToLeader(false);
  }, [contact]);

  const handleSave = async () => {
    // Determinar source_type e source_id corretamente
    let newSourceType = contact.source_type;
    let newSourceId: string | null = leaderId || null;

    // Se selecionou um líder (novo ou diferente), define como 'lider'
    if (leaderId) {
      newSourceType = 'lider';
    }
    // Se removeu o líder e era 'lider', limpa ambos
    else if (!leaderId && contact.source_type === 'lider') {
      newSourceType = null;
      newSourceId = null;
    }
    // Se não tinha líder e continua sem, mantém o source_type original

    // 1. Atualizar contato
    updateContact.mutate(
      {
        id: contact.id,
        data: {
          cidade_id: cidadeId,
          source_id: newSourceId,
          source_type: newSourceType,
          genero,
          data_nascimento: dataNascimento || null,
        },
      },
      {
        onSuccess: async () => {
          // 2. Se marcou para promover e tem user id, criar líder
          if (promoteToLeader && user?.id) {
            promoteToLeaderMutation.mutate({
              contact: {
                id: contact.id,
                nome: contact.nome,
                telefone_norm: contact.telefone_norm,
                email: contact.email,
                cidade_id: cidadeId,
                data_nascimento: contact.data_nascimento,
              },
              actionBy: user.id,
            });
          }
          onOpenChange(false);
        },
      }
    );
  };

  const isPending = updateContact.isPending || promoteToLeaderMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Contato</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Nome (read-only) */}
          <div>
            <Label>Nome</Label>
            <Input value={contact.nome} disabled className="bg-muted/50" />
          </div>

          {/* Telefone (read-only) */}
          <div>
            <Label>Telefone</Label>
            <Input value={contact.telefone_norm} disabled className="bg-muted/50" />
          </div>

          {/* Gênero */}
          <div>
            <Label>Gênero</Label>
            <Select value={genero} onValueChange={setGenero}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Masculino">Masculino</SelectItem>
                <SelectItem value="Feminino">Feminino</SelectItem>
                <SelectItem value="Não identificado">Não identificado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data de Nascimento */}
          <div>
            <Label>Data de Nascimento</Label>
            <MaskedDateInput
              value={dataNascimentoDisplay}
              onChange={(value) => {
                setDataNascimentoDisplay(value);
                if (value.length === 10 && isValidDateBR(value) && isNotFutureDate(value)) {
                  setDataNascimento(parseDateBR(value) || "");
                } else if (value === "") {
                  setDataNascimento("");
                }
              }}
            />
          </div>

          {/* Cidade/RA */}
          <div>
            <Label>{locationConfig.label}</Label>
            <LocationSelect
              value={cidadeId}
              localidadeValue={localidade}
              onLocationChange={({ cidadeId: cid, localidade: loc }) => {
                setCidadeId(cid || "");
                setLocalidade(loc || "");
              }}
            />
          </div>

          {/* Líder */}
          <div>
            <Label>Líder Responsável</Label>
            <LeaderAutocomplete
              value={leaderId}
              onValueChange={setLeaderId}
              placeholder="Buscar líder..."
              allowAllLeaders={true}
            />
          </div>

          {/* Seção: Promover a Líder */}
          <div className="border-t pt-4 mt-4">
            {!isAlreadyLeader ? (
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-500" />
                    <Label className="text-base font-medium">Promover a Líder</Label>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Transformar este contato em um líder da rede
                  </p>
                </div>
                <Switch
                  checked={promoteToLeader}
                  onCheckedChange={setPromoteToLeader}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <UserCheck className="h-3 w-3 mr-1" />
                  Este contato já é um líder
                </Badge>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
