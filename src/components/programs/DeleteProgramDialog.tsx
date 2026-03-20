import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useDeleteProgram } from "@/hooks/programs/useDeleteProgram";

interface DeleteProgramDialogProps {
  programId: string;
  programName: string;
  children: React.ReactNode;
}

export const DeleteProgramDialog = ({
  programId,
  programName,
  children,
}: DeleteProgramDialogProps) => {
  const { mutate: deleteProgram, isPending } = useDeleteProgram();

  const handleDelete = () => {
    deleteProgram(programId);
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Programa</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o programa "{programName}"?
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
