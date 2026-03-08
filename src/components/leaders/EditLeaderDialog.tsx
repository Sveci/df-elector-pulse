import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { OfficeLeader, UpdateLeaderDTO } from "@/types/office";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LocationSelect } from "@/components/office/LocationSelect";
import { useTenantLocationConfig } from "@/hooks/useTenantLocationConfig";
import { Pencil, Loader2 } from "lucide-react";
import { useUpdateLeader } from "@/hooks/leaders/useUpdateLeader";
import { 
  MaskedDateInput, 
  formatDateBR, 
  parseDateBR, 
  isValidDateBR, 
  isNotFutureDate 
} from "@/components/ui/masked-date-input";

const formSchema = z.object({
  nome_completo: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefone: z.string()
    .regex(/^55\d{10,11}$/, "Formato inválido. Use: 5561XXXXXXXXX")
    .optional()
    .or(z.literal("")),
  cidade_id: z.string().optional(),
  data_nascimento: z.string().optional(),
  observacao: z.string().optional(),
  instagram_username: z.string().optional(),
  is_active: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

interface EditLeaderDialogProps {
  leader: OfficeLeader;
  children: React.ReactNode;
}

export function EditLeaderDialog({ leader, children }: EditLeaderDialogProps) {
  const [open, setOpen] = useState(false);
  const [localidade, setLocalidade] = useState(leader.localidade || "");
  const locationConfig = useTenantLocationConfig();
  const [dataNascimentoDisplay, setDataNascimentoDisplay] = useState("");
  const { mutate: updateLeader, isPending } = useUpdateLeader();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome_completo: leader.nome_completo,
      email: leader.email || "",
      telefone: leader.telefone || "",
        cidade_id: leader.cidade_id || "",
        data_nascimento: leader.data_nascimento || "",
        observacao: leader.observacao || "",
        instagram_username: (leader as any).instagram_username || "",
        is_active: leader.is_active,
      },
    });
  
    // Atualizar valores quando o líder mudar
    useEffect(() => {
      if (open) {
        form.reset({
          nome_completo: leader.nome_completo,
          email: leader.email || "",
          telefone: leader.telefone || "",
          cidade_id: leader.cidade_id || "",
          data_nascimento: leader.data_nascimento || "",
          observacao: leader.observacao || "",
          instagram_username: (leader as any).instagram_username || "",
          is_active: leader.is_active,
        });
        setLocalidade(leader.localidade || "");
        setDataNascimentoDisplay(leader.data_nascimento ? formatDateBR(leader.data_nascimento) : "");
      }
    }, [leader, open, form]);

  const onSubmit = (data: FormData) => {
    updateLeader(
      { 
        id: leader.id, 
        data: data as UpdateLeaderDTO 
      },
      {
        onSuccess: () => {
          setOpen(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Editar Líder
          </DialogTitle>
          <DialogDescription>
            Atualize os dados do líder. A região administrativa pode ser definida aqui.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome_completo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="João Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (Opcional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="joao.silva@exemplo.com" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="telefone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone (Opcional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="5561999999999" 
                      {...field}
                      maxLength={13}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cidade_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{locationConfig.label}</FormLabel>
                  <FormControl>
                    <LocationSelect
                      value={field.value}
                      localidadeValue={localidade}
                      onLocationChange={({ cidadeId: cid, localidade: loc }) => {
                        field.onChange(cid || "");
                        setLocalidade(loc || "");
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="data_nascimento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Nascimento (Opcional)</FormLabel>
                  <FormControl>
                    <MaskedDateInput
                      value={dataNascimentoDisplay}
                      onChange={(value) => {
                        setDataNascimentoDisplay(value);
                        if (value.length === 10 && isValidDateBR(value) && isNotFutureDate(value)) {
                          field.onChange(parseDateBR(value));
                        } else if (value === "") {
                          field.onChange("");
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="instagram_username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instagram (Opcional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="@usuario" 
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observação (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Informações adicionais sobre o líder..."
                      {...field}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Status Ativo</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      O líder estará disponível no sistema
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
