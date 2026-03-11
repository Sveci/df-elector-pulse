import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";
import { toast } from "sonner";

export interface KBDocument {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  category: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size_bytes: number | null;
  status: string;
  total_chunks: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const KB_CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "mandato", label: "Mandato / Atuação" },
  { value: "programas", label: "Programas e Projetos" },
  { value: "faq", label: "Perguntas Frequentes" },
  { value: "biografia", label: "Biografia" },
  { value: "legislacao", label: "Legislação / Projetos de Lei" },
  { value: "pesquisas", label: "Pesquisas e Dados" },
  { value: "comunicacao", label: "Comunicação Oficial" },
];

export { KB_CATEGORIES };

export function useKBDocuments() {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ["kb-documents", tenantId],
    queryFn: async (): Promise<KBDocument[]> => {
      const { data, error } = await (supabase as any)
        .from("kb_documents")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });
}

export function useCreateKBDocument() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: async (doc: {
      title: string;
      description?: string;
      category: string;
      content: string;
      file_name?: string;
      file_type?: string;
      file_size_bytes?: number;
    }) => {
      // 1. Create document record
      const { data: docRecord, error: docError } = await (supabase as any)
        .from("kb_documents")
        .insert({
          title: doc.title,
          description: doc.description || null,
          category: doc.category,
          file_name: doc.file_name || null,
          file_type: doc.file_type || null,
          file_size_bytes: doc.file_size_bytes || null,
          tenant_id: tenantId,
          status: "processing",
        })
        .select()
        .single();

      if (docError) throw docError;

      // 2. Trigger processing via edge function
      const { error: processError } = await supabase.functions.invoke(
        "kb-process-document",
        {
          body: {
            document_id: docRecord.id,
            content: doc.content,
            tenant_id: tenantId,
          },
        }
      );

      if (processError) {
        console.error("Processing error:", processError);
        // Don't throw - doc was created, processing can be retried
      }

      return docRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-documents"] });
      toast.success("Documento adicionado à base de conhecimento!");
    },
    onError: (error) => {
      console.error("Error creating KB document:", error);
      toast.error("Erro ao adicionar documento");
    },
  });
}

export function useDeleteKBDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("kb_documents")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-documents"] });
      toast.success("Documento removido!");
    },
    onError: () => {
      toast.error("Erro ao remover documento");
    },
  });
}

export function useReprocessKBDocument() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      // Delete existing chunks
      await (supabase as any)
        .from("kb_chunks")
        .delete()
        .eq("document_id", id);

      // Re-process
      await supabase.functions.invoke("kb-process-document", {
        body: { document_id: id, content, tenant_id: tenantId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-documents"] });
      toast.success("Reprocessamento iniciado!");
    },
    onError: () => {
      toast.error("Erro ao reprocessar documento");
    },
  });
}
