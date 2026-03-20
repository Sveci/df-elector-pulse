import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Upload, X, Image as ImageIcon, Sparkles, FileText, File, Link2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  LeadFunnel,
  CreateFunnelData,
  useCreateFunnel,
  useUpdateFunnel,
  uploadFunnelAsset
} from "@/hooks/campaigns/useLeadFunnels";
import { toast } from "@/hooks/use-toast";

const formSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  slug: z.string()
    .min(3, "Slug deve ter pelo menos 3 caracteres")
    .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens")
    .optional()
    .or(z.literal('')),
  descricao: z.string().optional(),
  lead_magnet_nome: z.string().min(3, "Nome da isca é obrigatório"),
  lead_magnet_url: z.string().optional(),
  titulo: z.string().min(5, "Título deve ter pelo menos 5 caracteres"),
  subtitulo: z.string().optional(),
  texto_botao: z.string().min(1, "Texto do botão é obrigatório"),
  cor_botao: z.string(),
  campos_form: z.array(z.string()).min(1, "Selecione pelo menos um campo"),
  obrigado_titulo: z.string().min(5, "Título é obrigatório"),
  obrigado_subtitulo: z.string().optional(),
  obrigado_texto_botao: z.string().min(1, "Texto do botão é obrigatório"),
  cta_adicional_texto: z.string().optional(),
  cta_adicional_url: z.string().url("URL inválida").optional().or(z.literal('')),
  status: z.string(),
});

const generateSlugFromName = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
};

// Sanitize filename for Supabase storage (no spaces, special chars)
const sanitizeFileName = (filename: string): string => {
  const ext = filename.split('.').pop() || '';
  const name = filename.replace(/\.[^/.]+$/, '');
  const sanitized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return `${sanitized}.${ext}`;
};

type FormData = z.infer<typeof formSchema>;

interface CreateFunnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editFunnel?: LeadFunnel;
}

const AVAILABLE_FIELDS = [
  { value: 'nome', label: 'Nome Completo', required: true },
  { value: 'email', label: 'E-mail', required: true },
  { value: 'whatsapp', label: 'WhatsApp', required: false },
  { value: 'cidade', label: 'Cidade/RA', required: false },
];

const BUTTON_COLORS = [
  { value: '#10b981', label: 'Verde', class: 'bg-emerald-500' },
  { value: '#3b82f6', label: 'Azul', class: 'bg-blue-500' },
  { value: '#8b5cf6', label: 'Roxo', class: 'bg-violet-500' },
  { value: '#f59e0b', label: 'Laranja', class: 'bg-amber-500' },
  { value: '#ef4444', label: 'Vermelho', class: 'bg-red-500' },
  { value: '#ec4899', label: 'Rosa', class: 'bg-pink-500' },
];

const ACCEPTED_FILE_TYPES = '.pdf,.csv,.xls,.xlsx';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export function CreateFunnelDialog({ open, onOpenChange, editFunnel }: CreateFunnelDialogProps) {
  const [activeTab, setActiveTab] = useState("info");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(editFunnel?.cover_url || null);
  const [logoPreview, setLogoPreview] = useState<string | null>(editFunnel?.logo_url || null);
  const [removeCover, setRemoveCover] = useState(false);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());

  const createFunnel = useCreateFunnel();
  const updateFunnel = useUpdateFunnel();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: editFunnel?.nome || '',
      slug: editFunnel?.slug || '',
      descricao: editFunnel?.descricao || '',
      lead_magnet_nome: editFunnel?.lead_magnet_nome || '',
      lead_magnet_url: editFunnel?.lead_magnet_url || '',
      titulo: editFunnel?.titulo || '',
      subtitulo: editFunnel?.subtitulo || '',
      texto_botao: editFunnel?.texto_botao || 'Quero Receber',
      cor_botao: editFunnel?.cor_botao || '#10b981',
      campos_form: editFunnel?.campos_form || ['nome', 'email', 'whatsapp'],
      obrigado_titulo: editFunnel?.obrigado_titulo || 'Parabéns! Seu material está pronto.',
      obrigado_subtitulo: editFunnel?.obrigado_subtitulo || '',
      obrigado_texto_botao: editFunnel?.obrigado_texto_botao || 'Baixar Agora',
      cta_adicional_texto: editFunnel?.cta_adicional_texto || '',
      cta_adicional_url: editFunnel?.cta_adicional_url || '',
      status: editFunnel?.status || 'draft',
    },
  });

  useEffect(() => {
    if (editFunnel) {
      form.reset({
        nome: editFunnel.nome,
        slug: editFunnel.slug || '',
        descricao: editFunnel.descricao || '',
        lead_magnet_nome: editFunnel.lead_magnet_nome,
        lead_magnet_url: editFunnel.lead_magnet_url,
        titulo: editFunnel.titulo,
        subtitulo: editFunnel.subtitulo || '',
        texto_botao: editFunnel.texto_botao,
        cor_botao: editFunnel.cor_botao,
        campos_form: editFunnel.campos_form,
        obrigado_titulo: editFunnel.obrigado_titulo,
        obrigado_subtitulo: editFunnel.obrigado_subtitulo || '',
        obrigado_texto_botao: editFunnel.obrigado_texto_botao,
        cta_adicional_texto: editFunnel.cta_adicional_texto || '',
        cta_adicional_url: editFunnel.cta_adicional_url || '',
        status: editFunnel.status,
      });
      setCoverPreview(editFunnel.cover_url);
      setLogoPreview(editFunnel.logo_url);
      setRemoveCover(false);
      setRemoveLogo(false);
    }
  }, [editFunnel, form]);

  const handleFileChange = (type: 'cover' | 'logo', file: File | null, shouldRemove: boolean = false) => {
    if (type === 'cover') {
      setCoverFile(file);
      if (shouldRemove && !file) {
        setRemoveCover(true);
        setCoverPreview(null);
      } else {
        setRemoveCover(false);
        setCoverPreview(file ? URL.createObjectURL(file) : editFunnel?.cover_url || null);
      }
    } else {
      setLogoFile(file);
      if (shouldRemove && !file) {
        setRemoveLogo(true);
        setLogoPreview(null);
      } else {
        setRemoveLogo(false);
        setLogoPreview(file ? URL.createObjectURL(file) : editFunnel?.logo_url || null);
      }
    }
  };

  const handleMaterialChange = (file: File | null) => {
    if (file && file.size > MAX_FILE_SIZE) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 20MB",
        variant: "destructive",
      });
      return;
    }
    setMaterialFile(file);
    setAiFilledFields(new Set());
  };

  const handleGenerateWithAI = async () => {
    if (!materialFile) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Faça upload do material antes de gerar os textos",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append('file', materialFile);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-lead-magnet`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao analisar arquivo');
      }

      const data = await response.json();
      const suggestions = data.suggestions;

      if (suggestions) {
        const fieldsToFill = new Set<string>();

        if (suggestions.nome) {
          form.setValue('nome', suggestions.nome);
          fieldsToFill.add('nome');
        }
        if (suggestions.lead_magnet_nome) {
          form.setValue('lead_magnet_nome', suggestions.lead_magnet_nome);
          fieldsToFill.add('lead_magnet_nome');
        }
        if (suggestions.titulo) {
          form.setValue('titulo', suggestions.titulo);
          fieldsToFill.add('titulo');
        }
        if (suggestions.subtitulo) {
          form.setValue('subtitulo', suggestions.subtitulo);
          fieldsToFill.add('subtitulo');
        }
        if (suggestions.descricao) {
          form.setValue('descricao', suggestions.descricao);
          fieldsToFill.add('descricao');
        }
        if (suggestions.texto_botao) {
          form.setValue('texto_botao', suggestions.texto_botao);
          fieldsToFill.add('texto_botao');
        }
        if (suggestions.obrigado_titulo) {
          form.setValue('obrigado_titulo', suggestions.obrigado_titulo);
          fieldsToFill.add('obrigado_titulo');
        }
        if (suggestions.obrigado_subtitulo) {
          form.setValue('obrigado_subtitulo', suggestions.obrigado_subtitulo);
          fieldsToFill.add('obrigado_subtitulo');
        }
        if (suggestions.obrigado_texto_botao) {
          form.setValue('obrigado_texto_botao', suggestions.obrigado_texto_botao);
          fieldsToFill.add('obrigado_texto_botao');
        }

        setAiFilledFields(fieldsToFill);

        toast({
          title: "✨ Textos gerados com sucesso!",
          description: "Revise os campos preenchidos e ajuste se necessário",
        });
      }
    } catch (error: any) {
      console.error('Error generating with AI:', error);
      toast({
        title: "Erro ao gerar textos",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsUploading(true);

    try {
      // Handle cover URL - check for removal first
      let cover_url: string | null = removeCover ? null : (editFunnel?.cover_url || null);
      let logo_url: string | null = removeLogo ? null : (editFunnel?.logo_url || null);
      let lead_magnet_url = data.lead_magnet_url || editFunnel?.lead_magnet_url;

      // Upload cover if changed
      if (coverFile) {
        const path = `covers/${Date.now()}-${sanitizeFileName(coverFile.name)}`;
        cover_url = await uploadFunnelAsset(coverFile, path);
      }

      // Upload logo if changed
      if (logoFile) {
        const path = `logos/${Date.now()}-${sanitizeFileName(logoFile.name)}`;
        logo_url = await uploadFunnelAsset(logoFile, path);
      }

      // Upload material if provided
      if (materialFile) {
        const path = `materials/${Date.now()}-${sanitizeFileName(materialFile.name)}`;
        lead_magnet_url = await uploadFunnelAsset(materialFile, path);
      }

      if (!lead_magnet_url) {
        toast({
          title: "Material obrigatório",
          description: "Faça upload do material ou informe uma URL",
          variant: "destructive",
        });
        setIsUploading(false);
        return;
      }

      const funnelData: CreateFunnelData = {
        nome: data.nome,
        slug: data.slug || undefined,
        descricao: data.descricao,
        lead_magnet_nome: data.lead_magnet_nome,
        lead_magnet_url,
        titulo: data.titulo,
        subtitulo: data.subtitulo,
        texto_botao: data.texto_botao,
        cor_botao: data.cor_botao,
        campos_form: data.campos_form,
        obrigado_titulo: data.obrigado_titulo,
        obrigado_subtitulo: data.obrigado_subtitulo,
        obrigado_texto_botao: data.obrigado_texto_botao,
        cta_adicional_texto: data.cta_adicional_texto,
        cta_adicional_url: data.cta_adicional_url || undefined,
        status: data.status,
        cover_url,
        logo_url,
      };

      if (editFunnel) {
        await updateFunnel.mutateAsync({ id: editFunnel.id, ...funnelData });
      } else {
        await createFunnel.mutateAsync(funnelData);
      }

      onOpenChange(false);
      form.reset();
      setCoverFile(null);
      setLogoFile(null);
      setMaterialFile(null);
      setCoverPreview(null);
      setLogoPreview(null);
      setActiveTab("info");
      setAiFilledFields(new Set());
    } catch (error) {
      console.error('Error saving funnel:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const isLoading = createFunnel.isPending || updateFunnel.isPending || isUploading;

  const getFileIcon = () => {
    if (!materialFile) return <FileText className="h-8 w-8 text-muted-foreground" />;
    const ext = materialFile.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="h-8 w-8 text-red-500" />;
    return <File className="h-8 w-8 text-green-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const renderFieldWithAiBadge = (fieldName: string, children: React.ReactNode) => (
    <div className="relative">
      {children}
      {aiFilledFields.has(fieldName) && (
        <Badge
          variant="secondary"
          className="absolute -top-2 right-0 text-[10px] bg-violet-100 text-violet-700 hover:bg-violet-100"
        >
          <Sparkles className="h-3 w-3 mr-1" />
          IA
        </Badge>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {editFunnel ? 'Editar Funil de Captação' : 'Novo Funil de Captação'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="landing">Landing Page</TabsTrigger>
                <TabsTrigger value="obrigado">Pág. Obrigado</TabsTrigger>
              </TabsList>

              {/* Tab: Informações */}
              <TabsContent value="info" className="space-y-4 mt-4 overflow-y-auto flex-1 pr-1">
                {/* Material Upload Section */}
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    🎁 Isca Digital
                  </h4>

                  {/* File Upload */}
                  <div className="mb-4">
                    <Label>Arquivo do Material *</Label>
                    <div className="mt-2">
                      {materialFile ? (
                        <div className="flex items-center gap-3 p-3 border rounded-lg bg-background">
                          {getFileIcon()}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{materialFile.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(materialFile.size)} · {materialFile.name.split('.').pop()?.toUpperCase()}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMaterialChange(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-background hover:bg-muted/50 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                              Arraste seu arquivo ou <span className="text-primary">clique para enviar</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              PDF, XLS, XLSX, CSV (máx. 20MB)
                            </p>
                          </div>
                          <input
                            type="file"
                            className="hidden"
                            accept={ACCEPTED_FILE_TYPES}
                            onChange={(e) => handleMaterialChange(e.target.files?.[0] || null)}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* AI Generate Button */}
                  {materialFile && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full bg-gradient-to-r from-violet-50 to-purple-50 border-violet-200 hover:bg-violet-100"
                      onClick={handleGenerateWithAI}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analisando material...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2 text-violet-600" />
                          <span className="text-violet-700">Gerar textos com IA</span>
                        </>
                      )}
                    </Button>
                  )}

                  {/* Lead Magnet Name */}
                  {renderFieldWithAiBadge('lead_magnet_nome',
                    <FormField
                      control={form.control}
                      name="lead_magnet_nome"
                      render={({ field }) => (
                        <FormItem className="mt-4">
                          <FormLabel>Nome da Isca *</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: E-book: 10 Dicas de Produtividade" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* URL (hidden but kept for compatibility) */}
                  <FormField
                    control={form.control}
                    name="lead_magnet_url"
                    render={({ field }) => (
                      <FormItem className="mt-3">
                        <FormLabel>URL de Download (opcional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://... (deixe vazio se fez upload acima)"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Use apenas se preferir um link externo em vez do upload
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Funnel Name */}
                {renderFieldWithAiBadge('nome',
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Funil *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Guia Completo de Marketing" {...field} />
                        </FormControl>
                        <FormDescription>
                          Nome interno para identificação
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Slug da URL */}
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Slug da URL
                      </FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            placeholder="ex: guia-marketing-digital"
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const nome = form.getValues('nome');
                            if (nome) {
                              const slug = generateSlugFromName(nome);
                              form.setValue('slug', slug);
                            }
                          }}
                          title="Auto-gerar a partir do nome"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormDescription className="text-xs">
                        {field.value ? (
                          <span className="text-primary">
                            📎 URL: /captacao/{field.value}
                          </span>
                        ) : (
                          "Deixe vazio para gerar automaticamente"
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {renderFieldWithAiBadge('descricao',
                  <FormField
                    control={form.control}
                    name="descricao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descrição interna do funil..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">📝 Campos do Formulário</h4>

                  <FormField
                    control={form.control}
                    name="campos_form"
                    render={({ field }) => (
                      <FormItem>
                        <div className="space-y-2">
                          {AVAILABLE_FIELDS.map((item) => (
                            <div key={item.value} className="flex items-center space-x-2">
                              <Checkbox
                                id={item.value}
                                checked={field.value.includes(item.value)}
                                disabled={item.required}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    field.onChange([...field.value, item.value]);
                                  } else {
                                    field.onChange(field.value.filter((v: string) => v !== item.value));
                                  }
                                }}
                              />
                              <Label htmlFor={item.value} className="text-sm font-normal">
                                {item.label}
                                {item.required && <span className="text-muted-foreground ml-1">(obrigatório)</span>}
                              </Label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Rascunho</SelectItem>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="paused">Pausado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Apenas funis ativos aparecem na página pública
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Tab: Landing Page */}
              <TabsContent value="landing" className="space-y-4 mt-4 overflow-y-auto flex-1 pr-1">
                {/* Cover Image */}
                <div>
                  <Label>Imagem de Capa</Label>
                  <div className="mt-2">
                    {coverPreview ? (
                      <div className="relative">
                        <img
                          src={coverPreview}
                          alt="Cover preview"
                          className="w-full h-40 object-cover rounded-lg"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8"
                          onClick={() => handleFileChange('cover', null, true)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Clique para enviar imagem de capa</p>
                          <p className="text-xs text-muted-foreground">PNG, JPG (recomendado: 1200x630)</p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => handleFileChange('cover', e.target.files?.[0] || null)}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Logo */}
                <div>
                  <Label>Logo</Label>
                  <div className="mt-2">
                    {logoPreview ? (
                      <div className="relative inline-block">
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="h-20 w-auto object-contain bg-white rounded-lg p-2 shadow"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={() => handleFileChange('logo', null, true)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center w-40 h-20 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted">
                        <div className="text-center">
                          <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                          <p className="text-xs text-muted-foreground">Upload logo</p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => handleFileChange('logo', e.target.files?.[0] || null)}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {renderFieldWithAiBadge('titulo',
                  <FormField
                    control={form.control}
                    name="titulo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título Principal *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Descubra Como Dobrar Suas Vendas" {...field} />
                        </FormControl>
                        <FormDescription>
                          Headline que aparece no topo da página
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {renderFieldWithAiBadge('subtitulo',
                  <FormField
                    control={form.control}
                    name="subtitulo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subtítulo</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Ex: Aprenda as estratégias que os maiores vendedores usam..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {renderFieldWithAiBadge('texto_botao',
                  <FormField
                    control={form.control}
                    name="texto_botao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Texto do Botão *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Quero Receber Agora!" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="cor_botao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cor do Botão</FormLabel>
                      <div className="flex gap-2 mt-2">
                        {BUTTON_COLORS.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            className={`w-8 h-8 rounded-full transition-all ${color.class} ${
                              field.value === color.value
                                ? 'ring-2 ring-offset-2 ring-primary'
                                : 'hover:scale-110'
                            }`}
                            onClick={() => field.onChange(color.value)}
                            title={color.label}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Tab: Página de Obrigado */}
              <TabsContent value="obrigado" className="space-y-4 mt-4 overflow-y-auto flex-1 pr-1">
                {renderFieldWithAiBadge('obrigado_titulo',
                  <FormField
                    control={form.control}
                    name="obrigado_titulo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título de Sucesso *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 🎉 Parabéns! Seu material está pronto." {...field} />
                        </FormControl>
                        <FormDescription>
                          Mensagem exibida após o cadastro
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {renderFieldWithAiBadge('obrigado_subtitulo',
                  <FormField
                    control={form.control}
                    name="obrigado_subtitulo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subtítulo</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Ex: Clique no botão abaixo para baixar seu material"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {renderFieldWithAiBadge('obrigado_texto_botao',
                  <FormField
                    control={form.control}
                    name="obrigado_texto_botao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Texto do Botão de Download *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Baixar Agora" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">🔗 CTA Adicional (opcional)</h4>

                  <FormField
                    control={form.control}
                    name="cta_adicional_texto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Texto do Botão</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Agendar Consultoria Gratuita" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cta_adicional_url"
                    render={({ field }) => (
                      <FormItem className="mt-3">
                        <FormLabel>URL do Botão</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://calendly.com/seu-link"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Link para onde o botão adicional vai direcionar
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editFunnel ? 'Salvar Alterações' : 'Criar Funil'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}