import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useDeactivateContact } from "@/hooks/contacts/useDeactivateContact";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, UserMinus } from "lucide-react";

interface DeactivateContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: {
    id: string;
    name: string;
  } | null;
}

export function DeactivateContactDialog({
  open,
  onOpenChange,
  contact,
}: DeactivateContactDialogProps) {
  const [reason, setReason] = useState("");
  const deactivateMutation = useDeactivateContact();
  const { user } = useAuth();

  const handleDeactivate = () => {
    if (!contact) return;

    deactivateMutation.mutate(
      {
        contactId: contact.id,
        reason: reason || "Desativado pelo administrador",
        userId: user?.id,
      },
      {
        onSuccess: () => {
          setReason("");
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <UserMinus className="h-5 w-5 text-destructive" />
            Desativar Contato
          </AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja desativar <strong>{contact?.name}</strong>?
            <br />
            Este contato não receberá mais comunicações por email ou WhatsApp.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <Label htmlFor="reason" className="text-sm font-medium">
            Motivo (opcional)
          </Label>
          <Textarea
            id="reason"
            placeholder="Ex: Solicitou descadastro por telefone..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-2"
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deactivateMutation.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeactivate}
            disabled={deactivateMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deactivateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Desativar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
