import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ShieldCheck, ShieldAlert, Send, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function VerificationSummaryCard() {
  // Buscar estatísticas de verificação
  const { data: stats, isLoading } = useQuery({
    queryKey: ["verification-stats"],
    queryFn: async () => {
      // Total de contatos indicados por líder
      const { count: totalLeaderIndicated } = await supabase
        .from("office_contacts")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("source_type", "lider");

      // Contatos que nunca receberam SMS (verification_sent_at IS NULL)
      const { count: smsNotSent } = await supabase
        .from("office_contacts")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("source_type", "lider")
        .eq("is_verified", false)
        .is("verification_sent_at", null);

      // Contatos que receberam SMS mas não verificaram
      const { count: waitingVerification } = await supabase
        .from("office_contacts")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("source_type", "lider")
        .eq("is_verified", false)
        .not("verification_sent_at", "is", null);

      // Contatos verificados
      const { count: verified } = await supabase
        .from("office_contacts")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("source_type", "lider")
        .eq("is_verified", true);

      return {
        total: totalLeaderIndicated || 0,
        smsNotSent: smsNotSent || 0,
        waitingVerification: waitingVerification || 0,
        verified: verified || 0,
      };
    },
  });

  if (isLoading || !stats || stats.smsNotSent === 0) {
    return null;
  }

  const verificationRate = stats.total > 0
    ? Math.round((stats.verified / stats.total) * 100)
    : 0;

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-100">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Verificação de Contatos</h3>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-amber-700">{stats.smsNotSent}</span> contatos nunca receberam SMS de verificação
                {stats.waitingVerification > 0 && (
                  <> • <span className="font-semibold text-blue-600">{stats.waitingVerification}</span> aguardando verificação</>
                )}
                {stats.verified > 0 && (
                  <> • <span className="font-semibold text-emerald-600">{stats.verified}</span> verificados ({verificationRate}%)</>
                )}
              </p>
            </div>
          </div>

          <Link to="/sms">
            <Button size="sm" className="gap-2 bg-amber-600 hover:bg-amber-700">
              <MessageSquare className="h-4 w-4" />
              Enviar SMS
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
