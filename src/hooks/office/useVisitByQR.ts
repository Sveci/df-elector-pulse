import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface VisitByQR {
  id: string;
  status: string;
  checked_in: boolean;
  checked_in_at: string | null;
  protocolo: string;
  contact_nome: string | null;
  contact_telefone: string | null;
  city_nome: string | null;
  leader_nome: string | null;
}

export function useVisitByQR(qrCode: string) {
  return useQuery({
    queryKey: ["visit_by_qr", qrCode],
    queryFn: async (): Promise<VisitByQR | null> => {
      const { data, error } = await supabase
        .rpc("get_visit_by_qr", { _qr_code: qrCode });

      if (error) throw error;

      // RPC returns an array, get the first result
      if (data && data.length > 0) {
        return data[0] as VisitByQR;
      }
      return null;
    },
    enabled: !!qrCode
  });
}
