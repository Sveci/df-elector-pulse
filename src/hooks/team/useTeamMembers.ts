import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MemberTenant {
  tenant_id: string;
  tenant_name: string;
  role: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  is_active: boolean;
  role: string | null;
  last_login: string | null;
  tenants: MemberTenant[];
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, email, avatar_url, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch users, user_roles, and user_tenants in parallel
      const [usersRes, rolesRes, tenantsRes] = await Promise.all([
        supabase.from("users").select("id, is_active, last_login"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("user_tenants").select("user_id, tenant_id, role, tenant:tenants(nome)"),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (tenantsRes.error) throw tenantsRes.error;

      // Combine data
      const members: TeamMember[] = (profiles || []).map((profile) => {
        const user = usersRes.data?.find((u) => u.id === profile.id);
        const userRole = rolesRes.data?.find((r) => r.user_id === profile.id);
        const userTenants = tenantsRes.data?.filter((t) => t.user_id === profile.id) || [];

        return {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          avatar_url: profile.avatar_url,
          created_at: profile.created_at,
          is_active: user?.is_active ?? true,
          role: userRole?.role || null,
          last_login: user?.last_login || null,
          tenants: userTenants.map((t) => ({
            tenant_id: t.tenant_id,
            tenant_name: (t.tenant as any)?.nome || "—",
            role: t.role,
          })),
        };
      });

      return members;
    },
  });
}
