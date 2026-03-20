import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ContactSearchResult {
  id: string;
  nome: string;
  telefone_norm: string;
  cidade_id: string | null;
  cidade: {
    id: string;
    nome: string;
  } | null;
  last_leader_id: string | null;
  last_leader: {
    id: string;
    nome_completo: string;
  } | null;
  source?: 'contact' | 'leader';
}

export function useSearchContactsByPhone(phone: string) {
  // Remove tudo que não for dígito
  const digitsOnly = phone.replace(/\D/g, "");

  return useQuery({
    queryKey: ["contacts-search-phone", digitsOnly],
    queryFn: async (): Promise<ContactSearchResult[]> => {
      if (digitsOnly.length < 3) return [];

      // Buscar contatos e líderes em paralelo
      const [contactsResult, leadersResult] = await Promise.all([
        // Buscar contatos
        supabase
          .from("office_contacts")
          .select("id, nome, telefone_norm, cidade_id, cidade:office_cities(id, nome)")
          .ilike("telefone_norm", `%${digitsOnly}%`)
          .eq("is_active", true)
          .order("nome")
          .limit(10),

        // Buscar líderes
        supabase
          .from("lideres")
          .select(`
            id, 
            nome_completo, 
            telefone,
            cidade_id, 
            cidade:office_cities(id, nome),
            parent_leader_id,
            parent_leader:lideres!lideres_parent_leader_id_fkey(id, nome_completo)
          `)
          .ilike("telefone", `%${digitsOnly}%`)
          .eq("is_active", true)
          .order("nome_completo")
          .limit(10)
      ]);

      const contacts = contactsResult.data || [];
      const leaders = leadersResult.data || [];

      if (contactsResult.error) {
        console.error("Erro ao buscar contatos:", contactsResult.error);
      }

      if (leadersResult.error) {
        console.error("Erro ao buscar líderes:", leadersResult.error);
      }

      // Buscar o último líder de cada contato baseado nas visitas
      const contactIds = contacts.map(c => c.id);
      const lastLeaderByContact: Record<string, { id: string; nome_completo: string }> = {};

      if (contactIds.length > 0) {
        const { data: visits } = await supabase
          .from("office_visits")
          .select("contact_id, leader_id, created_at, leader:lideres(id, nome_completo)")
          .in("contact_id", contactIds)
          .not("leader_id", "is", null)
          .order("created_at", { ascending: false });

        if (visits) {
          for (const visit of visits) {
            if (visit.contact_id && !lastLeaderByContact[visit.contact_id] && visit.leader) {
              lastLeaderByContact[visit.contact_id] = visit.leader as { id: string; nome_completo: string };
            }
          }
        }
      }

      // Mapear contatos
      const contactResults: ContactSearchResult[] = contacts.map(contact => ({
        ...contact,
        last_leader_id: lastLeaderByContact[contact.id]?.id || null,
        last_leader: lastLeaderByContact[contact.id] || null,
        source: 'contact' as const,
      }));

      // Mapear líderes para o formato de contato (usando coordenador como "last_leader")
      const leaderResults: ContactSearchResult[] = leaders.map(leader => {
        // parent_leader pode vir como array (devido ao join) ou null
        const parentLeaderData = leader.parent_leader;
        const parentLeader = Array.isArray(parentLeaderData)
          ? parentLeaderData[0] as { id: string; nome_completo: string } | undefined
          : parentLeaderData as { id: string; nome_completo: string } | null;

        return {
          id: leader.id,
          nome: leader.nome_completo,
          telefone_norm: leader.telefone || "",
          cidade_id: leader.cidade_id,
          cidade: leader.cidade as { id: string; nome: string } | null,
          last_leader_id: leader.parent_leader_id,
          last_leader: parentLeader || null,
          source: 'leader' as const,
        };
      });

      // Combinar resultados, removendo duplicatas (priorizar líderes sobre contatos)
      const leaderIds = new Set(leaderResults.map(l => l.id));
      const uniqueContacts = contactResults.filter(c => !leaderIds.has(c.id));

      return [...leaderResults, ...uniqueContacts];
    },
    enabled: digitsOnly.length >= 3,
    staleTime: 1000 * 30, // 30 seconds
  });
}
