import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContactActivity {
  id: string;
  contact_id: string;
  action: string;
  action_by: string | null;
  details: {
    leader_id?: string;
    leader_name?: string;
    reason?: string;
    old_value?: string;
    new_value?: string;
    field?: string;
    event_name?: string;
    template_name?: string;
  } | null;
  created_at: string;
  user_name?: string | null;
}

export function useContactActivityLog(contactId: string | undefined) {
  return useQuery({
    queryKey: ["contact_activity_log", contactId],
    queryFn: async () => {
      if (!contactId) return [];

      // Buscar atividades
      const { data: activities, error } = await supabase
        .from("contact_activity_log")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!activities || activities.length === 0) return [];

      // Buscar nomes dos usuários que realizaram as ações
      const userIds = [...new Set(activities.filter(a => a.action_by).map(a => a.action_by))];

      let usersMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, name")
          .in("id", userIds);

        if (users) {
          usersMap = new Map(users.map(u => [u.id, u.name]));
        }
      }

      return activities.map(activity => ({
        ...activity,
        details: activity.details as ContactActivity["details"],
        user_name: activity.action_by ? usersMap.get(activity.action_by) || null : null,
      })) as ContactActivity[];
    },
    enabled: !!contactId,
  });
}
