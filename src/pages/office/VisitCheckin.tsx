import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useVisitByQR } from "@/hooks/office/useVisitByQR";
import { useUpdateVisitCheckIn } from "@/hooks/office/useUpdateVisitCheckIn";
import { Loader2, CheckCircle2, XCircle, User, Phone, MapPin, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function VisitCheckin() {
  const { qrCode } = useParams();
  const navigate = useNavigate();
  const { data: visit, isLoading } = useVisitByQR(qrCode || "");
  const updateCheckIn = useUpdateVisitCheckIn();

  const handleCheckIn = async () => {
    if (!qrCode) return;
    await updateCheckIn.mutateAsync(qrCode);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              QR Code Inválido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              O QR Code escaneado não corresponde a nenhuma visita registrada.
            </p>
            <Button onClick={() => navigate("/office/queue")} variant="outline" className="w-full">
              Voltar para Fila
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (visit.checked_in) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-green-200">
          <CardHeader className="bg-green-50">
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              Check-in Já Realizado
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Visitante</p>
                <p className="font-medium">{visit.contact_nome}</p>
              </div>
            </div>

            {visit.checked_in_at && (
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Check-in realizado em</p>
                  <p className="font-medium">
                    {format(new Date(visit.checked_in_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            )}

            <Button onClick={() => navigate("/office/queue")} className="w-full mt-6">
              Voltar para Fila
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Confirmar Presença</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Visitante</p>
                <p className="font-medium">{visit.contact_nome}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="font-medium">{visit.contact_telefone}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Cidade</p>
                <p className="font-medium">{visit.city_nome}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => navigate("/office/queue")}
              variant="outline"
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCheckIn}
              disabled={updateCheckIn.isPending}
              className="flex-1"
            >
              {updateCheckIn.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirmar Presença
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
