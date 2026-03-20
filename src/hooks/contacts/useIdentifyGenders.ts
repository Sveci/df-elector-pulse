import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useIdentifyGenders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // 1. Buscar todos os contatos sem gênero identificado
      const { data: contacts, error: fetchError } = await supabase
        .from('office_contacts')
        .select('id, nome, genero')
        .eq('genero', 'Não identificado');

      if (fetchError) throw fetchError;
      if (!contacts || contacts.length === 0) {
        return { processed: 0, message: "Todos os contatos já possuem gênero identificado" };
      }

      console.log(`Found ${contacts.length} contacts to identify`);

      const BATCH_SIZE = 20; // Processar 20 nomes por vez para evitar respostas truncadas
      const batches = [];

      for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
        batches.push(contacts.slice(i, i + BATCH_SIZE));
      }

      let totalProcessed = 0;
      const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/identify-gender`;

      // 2. Processar cada lote
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];

        console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} names`);

        const response = await fetch(FUNCTION_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ names: batch }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Erro ao identificar gêneros");
        }

        const { results } = await response.json();

        // 3. Atualizar banco de dados com os resultados
        for (const result of results) {
          const { error: updateError } = await supabase
            .from('office_contacts')
            .update({ genero: result.genero })
            .eq('id', result.id);

          if (updateError) {
            console.error(`Error updating contact ${result.id}:`, updateError);
          }
        }

        totalProcessed += results.length;

        // Aguardar 2 segundos entre lotes para evitar rate limiting
        if (batchIndex < batches.length - 1) {
          console.log("Waiting 2 seconds before next batch...");
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      return {
        processed: totalProcessed,
        message: `${totalProcessed} contato(s) atualizado(s) com sucesso!`
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast({
        title: "✅ Identificação concluída",
        description: data.message,
      });
    },
    onError: (error: any) => {
      console.error("Erro ao identificar gêneros:", error);
      toast({
        title: "❌ Erro na identificação",
        description: error.message || "Erro ao processar identificação de gêneros",
        variant: "destructive",
      });
    },
  });
}
