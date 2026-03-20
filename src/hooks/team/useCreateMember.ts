import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateMemberData {
  email: string;
  password: string;
  name: string;
  role: string;
  phone?: string;
}

export function useCreateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateMemberData) => {
      const { data: result, error } = await supabase.functions.invoke(
        "create-admin-user",
        {
          body: {
            email: data.email,
            password: data.password,
            name: data.name,
            role: data.role,
            phone: data.phone,
          },
        }
      );

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });

      const notifications = result?.notifications;
      if (notifications?.emailSent && notifications?.whatsappSent) {
        toast.success("Membro adicionado! Credenciais enviadas por email e WhatsApp.");
      } else if (notifications?.emailSent) {
        toast.success("Membro adicionado! Credenciais enviadas por email.");
      } else {
        toast.success("Membro adicionado com sucesso!");
      }
    },
    onError: (error) => {
      console.error("Erro ao criar membro:", error);
      toast.error("Erro ao adicionar membro: " + error.message);
    },
  });
}
