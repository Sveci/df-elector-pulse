import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useCustomDomain() {
  const [isSyncing, setIsSyncing] = useState(false);

  const registerDomain = async (tenantId: string, domain: string) => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "register", tenant_id: tenantId, domain },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Domínio registrado!",
        description: `${domain} foi registrado no SaaSCustomDomains. Configure o CNAME para in.saascustomdomains.com`,
      });

      return data;
    } catch (err: any) {
      toast({
        title: "Erro ao registrar domínio",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteDomain = async (tenantId: string) => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "delete", tenant_id: tenantId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Domínio removido", description: "O domínio foi desregistrado." });
      return data;
    } catch (err: any) {
      toast({
        title: "Erro ao remover domínio",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  const checkStatus = async (tenantId: string) => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-custom-domain", {
        body: { action: "status", tenant_id: tenantId },
      });

      if (error) throw error;
      return data;
    } catch (err: any) {
      toast({
        title: "Erro ao verificar status",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  return { registerDomain, deleteDomain, checkStatus, isSyncing };
}
