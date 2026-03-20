import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface LeaderTreeNode {
  id: string;
  nome_completo: string;
  email: string | null;
  telefone: string | null;
  parent_leader_id: string | null;
  hierarchy_level: number | null;
  depth: number;
  cadastros: number;
  pontuacao_total: number;
  is_active: boolean;
  cidade_id: string | null;
  children?: LeaderTreeNode[];
}

export interface CoordinatorStats {
  total_leaders: number;
  total_cadastros: number;
  total_pontos: number;
}

export interface Coordinator {
  id: string;
  nome_completo: string;
  email: string | null;
  telefone: string | null;
  cidade_id: string | null;
  cidade_nome: string | null;
  cadastros: number;
  pontuacao_total: number;
  total_leaders: number;
  total_cadastros: number;
  total_pontos: number;
}

// Fetch all coordinators with their network stats
export function useCoordinators() {
  return useQuery({
    queryKey: ["coordinators"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_all_coordinators_with_stats");

      if (error) throw error;
      return data as Coordinator[];
    },
  });
}

// Fetch leader tree for a coordinator
export function useLeaderTree(coordinatorId: string | null) {
  return useQuery({
    queryKey: ["leader-tree", coordinatorId],
    queryFn: async () => {
      if (!coordinatorId) return null;

      // RPCs via PostgREST can be capped (commonly 1000 rows). Large trees
      // need paging to avoid missing deeper levels.
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;
      const allNodes: LeaderTreeNode[] = [];

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
          .rpc("get_leader_tree", { _leader_id: coordinatorId })
          .range(from, to);

        if (error) throw error;

        const batch = (data as LeaderTreeNode[]) || [];
        allNodes.push(...batch);

        hasMore = batch.length === pageSize;
        page++;
      }

      return buildTree(allNodes, coordinatorId);
    },
    enabled: !!coordinatorId,
  });
}

// Build tree structure from flat list
function buildTree(nodes: LeaderTreeNode[], rootId: string): LeaderTreeNode | null {
  const nodeMap = new Map<string, LeaderTreeNode>();

  // Create a map of all nodes
  nodes.forEach(node => {
    nodeMap.set(node.id, { ...node, children: [] });
  });

  let root: LeaderTreeNode | null = null;

  // Build the tree
  nodes.forEach(node => {
    const current = nodeMap.get(node.id)!;
    if (node.id === rootId) {
      root = current;
    } else if (node.parent_leader_id && nodeMap.has(node.parent_leader_id)) {
      const parent = nodeMap.get(node.parent_leader_id)!;
      if (!parent.children) parent.children = [];
      parent.children.push(current);
    }
  });

  return root;
}

// Fetch coordinator network stats
export function useCoordinatorStats(coordinatorId: string | null) {
  return useQuery({
    queryKey: ["coordinator-stats", coordinatorId],
    queryFn: async () => {
      if (!coordinatorId) return null;

      const { data, error } = await supabase.rpc("get_coordinator_network_stats", {
        _coordinator_id: coordinatorId,
      });

      if (error) throw error;
      return data?.[0] as CoordinatorStats | null;
    },
    enabled: !!coordinatorId,
  });
}

// Fetch leaders by search term (server-side)
export interface LeaderSearchResult {
  id: string;
  nome_completo: string;
  email: string | null;
  telefone: string | null;
  is_coordinator: boolean;
  hierarchy_level: number | null;
  parent_leader_id: string | null;
  cidade_nome: string | null;
}

export function useSearchLeaders(searchTerm: string) {
  const trimmed = searchTerm.trim();
  return useQuery({
    queryKey: ["search-leaders", trimmed],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("search_leaders_by_term", {
        _term: trimmed,
        _limit: 30,
      });
      if (error) throw error;
      return (data || []) as LeaderSearchResult[];
    },
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
  });
}

// Fetch available leaders for promotion to coordinator
export function useAvailableLeaders() {
  return useQuery({
    queryKey: ["available-leaders"],
    queryFn: async () => {
      const allLeaders: any[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
          .from("lideres")
          .select("id, nome_completo, email, telefone, cadastros, pontuacao_total, cidade:office_cities(nome)")
          .eq("is_coordinator", false)
          .eq("is_active", true)
          .order("nome_completo")
          .range(from, to);

        if (error) throw error;

        if (data && data.length > 0) {
          allLeaders.push(...data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      return allLeaders;
    },
  });
}

// Promote leader to coordinator
export function usePromoteToCoordinator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leaderId: string) => {
      const { data, error } = await supabase.rpc("promote_to_coordinator", {
        _leader_id: leaderId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coordinators"] });
      queryClient.invalidateQueries({ queryKey: ["available-leaders"] });
      queryClient.invalidateQueries({ queryKey: ["leaders"] });
      toast({
        title: "Líder promovido",
        description: "O líder foi promovido a coordenador com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao promover líder",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Demote coordinator
export function useDemoteCoordinator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leaderId: string) => {
      const { data, error } = await supabase.rpc("demote_coordinator", {
        _leader_id: leaderId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coordinators"] });
      queryClient.invalidateQueries({ queryKey: ["available-leaders"] });
      queryClient.invalidateQueries({ queryKey: ["leaders"] });
      queryClient.invalidateQueries({ queryKey: ["leader-tree"] });
      toast({
        title: "Coordenador rebaixado",
        description: "O coordenador foi removido da hierarquia.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao rebaixar coordenador",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Set parent leader (add subordinate)
export function useSetParentLeader() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leaderId, parentId }: { leaderId: string; parentId: string }) => {
      const { data, error } = await supabase.rpc("set_parent_leader", {
        _leader_id: leaderId,
        _parent_id: parentId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leader-tree"] });
      queryClient.invalidateQueries({ queryKey: ["available-leaders"] });
      queryClient.invalidateQueries({ queryKey: ["coordinator-stats"] });
      toast({
        title: "Subordinado adicionado",
        description: "O líder foi vinculado à hierarquia com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao vincular líder",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Remove leader from tree
export function useRemoveFromTree() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leaderId: string) => {
      const { data, error } = await supabase.rpc("remove_from_tree", {
        _leader_id: leaderId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leader-tree"] });
      queryClient.invalidateQueries({ queryKey: ["available-leaders"] });
      queryClient.invalidateQueries({ queryKey: ["coordinator-stats"] });
      toast({
        title: "Líder removido",
        description: "O líder foi removido da hierarquia.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover líder",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Move leader branch to a new parent
export function useMoveLeaderBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leaderId, newParentId }: { leaderId: string; newParentId: string }) => {
      const { data, error } = await supabase.rpc("move_leader_branch", {
        _leader_id: leaderId,
        _new_parent_id: newParentId,
      });

      if (error) throw error;

      // A função agora retorna boolean
      if (!data) {
        throw new Error("Erro ao mover líder");
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leader-tree"] });
      queryClient.invalidateQueries({ queryKey: ["coordinators"] });
      queryClient.invalidateQueries({ queryKey: ["coordinator-stats"] });
      toast({
        title: "Líder movido",
        description: "O líder foi movido para a nova árvore com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao mover líder",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Promote leader to coordinator with all subordinates
export function usePromoteToCoordinatorWithSubordinates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leaderId: string) => {
      const { data, error } = await supabase.rpc("promote_to_coordinator_with_subordinates", {
        _leader_id: leaderId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string; subordinates_moved?: number };

      if (!result.success) {
        throw new Error(result.error || "Erro ao promover líder");
      }

      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["coordinators"] });
      queryClient.invalidateQueries({ queryKey: ["leader-tree"] });
      queryClient.invalidateQueries({ queryKey: ["available-leaders"] });
      queryClient.invalidateQueries({ queryKey: ["coordinator-stats"] });
      queryClient.invalidateQueries({ queryKey: ["leaders"] });
      toast({
        title: "Líder promovido a Coordenador",
        description: data.message || "O líder e seus subordinados foram promovidos com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao promover líder",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Count subordinates of a leader
export function countSubordinates(node: LeaderTreeNode): number {
  if (!node.children || node.children.length === 0) return 0;
  return node.children.reduce((acc, child) => acc + 1 + countSubordinates(child), 0);
}

// Calculate max depth of subordinate subtree (0 = no children)
export function maxSubtreeDepth(node: LeaderTreeNode): number {
  if (!node.children || node.children.length === 0) return 0;
  return 1 + Math.max(...node.children.map(maxSubtreeDepth));
}
