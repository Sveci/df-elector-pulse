import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useSMSTemplates, useUpdateSMSTemplate, useCreateSMSTemplate } from "@/hooks/useSMSTemplates";

const formSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  slug: z.string().min(1, "Slug é obrigatório").regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
  categoria: z.string().min(1, "Categoria é obrigatória"),
  mensagem: z.string().min(1, "Mensagem é obrigatória").max(160, "SMS deve ter no máximo 160 caracteres"),
});

type FormData = z.infer<typeof formSchema>;

interface SMSTemplateEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string | null;
}

const CATEGORIAS = [
  { value: "eventos", label: "Eventos" },
  { value: "captacao", label: "Captação" },
  { value: "verificacao", label: "Verificação" },
  { value: "pesquisa", label: "Pesquisa" },
  { value: "geral", label: "Geral" },
];

export function SMSTemplateEditorDialog({
  open,
  onOpenChange,
  templateId,
}: SMSTemplateEditorDialogProps) {
  const { data: templates, refetch } = useSMSTemplates();
  const updateTemplate = useUpdateSMSTemplate();
  const createTemplate = useCreateSMSTemplate();

  const [detectedVariables, setDetectedVariables] = useState<string[]>([]);

  const template = templates?.find((t) => t.id === templateId);
  const isEditing = !!templateId;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      slug: "",
      categoria: "geral",
      mensagem: "",
    },
  });

  useEffect(() => {
    if (template && isEditing) {
      form.reset({
        nome: template.nome,
        slug: template.slug,
        categoria: template.categoria,
        mensagem: template.mensagem,
      });
      setDetectedVariables(template.variaveis || []);
    } else if (!isEditing) {
      form.reset({
        nome: "",
        slug: "",
        categoria: "geral",
        mensagem: "",
      });
      setDetectedVariables([]);
    }
  }, [template, isEditing, form]);

  const mensagem = form.watch("mensagem");

  useEffect(() => {
    const matches = mensagem.match(/\{\{([^}]+)\}\}/g) || [];
    const variables = matches.map((match) => match.replace(/\{\{|\}\}/g, ""));
    setDetectedVariables([...new Set(variables)]);
  }, [mensagem]);

  const onSubmit = async (data: FormData) => {
    if (isEditing && templateId) {
      await updateTemplate.mutateAsync({
        id: templateId,
        data: {
          nome: data.nome,
          mensagem: data.mensagem,
          variaveis: detectedVariables,
        },
      });
    } else {
      await createTemplate.mutateAsync({
        slug: data.slug,
        nome: data.nome,
        mensagem: data.mensagem,
        categoria: data.categoria,
        variaveis: detectedVariables,
      });
    }
    // Force refetch to ensure UI is updated everywhere
    await refetch();
    onOpenChange(false);
  };

  const generateSlug = () => {
    const nome = form.getValues("nome");
    const slug = nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    form.setValue("slug", slug);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Template SMS" : "Novo Template SMS"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Convite para Evento"
                        onBlur={() => {
                          if (!isEditing && !form.getValues("slug")) {
                            generateSlug();
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
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="convite-evento"
                        disabled={isEditing}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="categoria"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isEditing}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CATEGORIAS.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mensagem"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mensagem</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Olá {{nome}}! Você está convidado..."
                      rows={4}
                      maxLength={160}
                    />
                  </FormControl>
                  <FormDescription className="flex justify-between">
                    <span>Use {"{{variavel}}"} para inserir dados dinâmicos</span>
                    <span className={mensagem.length > 160 ? "text-destructive" : ""}>
                      {mensagem.length}/160
                    </span>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {detectedVariables.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Variáveis detectadas:</p>
                <div className="flex flex-wrap gap-2">
                  {detectedVariables.map((variable) => (
                    <Badge key={variable} variant="secondary">
                      {`{{${variable}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateTemplate.isPending || createTemplate.isPending}
              >
                {isEditing ? "Salvar" : "Criar Template"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
