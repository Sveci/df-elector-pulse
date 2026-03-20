import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Mail, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { parseCSV } from "@/utils/csvParser";
import { useUpdateContactEmails } from "@/hooks/contacts/useUpdateContactEmails";

interface ContactEmailUpdate {
  nome: string;
  email: string;
  whatsapp: string;
}

export function ImportEmailsDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ContactEmailUpdate[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [updateResult, setUpdateResult] = useState<{
    updated: number;
    notFound: Array<{ line: number; reason: string; nome: string; whatsapp: string }>;
  } | null>(null);

  const updateEmailsMutation = useUpdateContactEmails();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setValidationErrors([]);
    setUpdateResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const result = parseCSV<ContactEmailUpdate>(text, [
          'Nome Completo',
          'E-mail',
          'WhatsApp'
        ]);

        if (result.errors.length > 0) {
          setValidationErrors(result.errors.map(err => `Linha ${err.row}: ${err.message}`));
        }

        const mapped = result.data.map((row: any) => ({
          nome: row['Nome Completo'] || row['nome'] || '',
          email: row['E-mail'] || row['email'] || '',
          whatsapp: row['WhatsApp'] || row['whatsapp'] || row['telefone'] || ''
        }));

        const filtered = mapped.filter(item =>
          item.nome && item.email && item.whatsapp
        );

        if (filtered.length === 0) {
          setValidationErrors(['Nenhum dado válido encontrado. Certifique-se que o CSV possui as colunas: Nome Completo, E-mail, WhatsApp']);
        }

        setParsedData(filtered);
      } catch (error) {
        setValidationErrors(['Erro ao ler arquivo: ' + (error as Error).message]);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleUpdate = async () => {
    if (parsedData.length === 0) return;

    try {
      const result = await updateEmailsMutation.mutateAsync(parsedData);
      setUpdateResult({
        updated: result.updated,
        notFound: result.notFound
      });
    } catch (error) {
      console.error('Erro ao atualizar e-mails:', error);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setFile(null);
    setParsedData([]);
    setValidationErrors([]);
    setUpdateResult(null);
  };

  const isProcessing = updateEmailsMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Mail className="mr-2 h-4 w-4" />
          Importar E-mails
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atualizar E-mails de Contatos</DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo CSV com as colunas: Nome Completo, E-mail, WhatsApp.
            O sistema irá atualizar apenas os contatos onde o telefone E o nome coincidirem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!updateResult && (
            <>
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="email-csv-upload"
                  disabled={isProcessing}
                />
                <label htmlFor="email-csv-upload">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isProcessing}
                    onClick={() => document.getElementById('email-csv-upload')?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Selecionar Arquivo CSV
                  </Button>
                </label>
                {file && (
                  <span className="text-sm text-muted-foreground">
                    {file.name}
                  </span>
                )}
              </div>

              {validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold mb-2">Erros de validação:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {validationErrors.map((error, index) => (
                        <li key={index} className="text-sm">{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {parsedData.length > 0 && validationErrors.length === 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold mb-2">
                      Arquivo pronto para processamento
                    </div>
                    <p className="text-sm">
                      {parsedData.length} contatos encontrados no arquivo
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {isProcessing && (
                <div className="space-y-2">
                  <Progress value={undefined} className="w-full" />
                  <p className="text-sm text-center text-muted-foreground">
                    Processando atualizações...
                  </p>
                </div>
              )}
            </>
          )}

          {updateResult && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Resultado da Atualização</div>
                  <div className="space-y-1 text-sm">
                    <p>✅ <strong>{updateResult.updated}</strong> e-mails atualizados com sucesso</p>
                    <p>⚠️ <strong>{updateResult.notFound.length}</strong> não encontrados ou com nome diferente</p>
                  </div>
                </AlertDescription>
              </Alert>

              {updateResult.notFound.length > 0 && (
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                  <h4 className="font-semibold mb-2 text-sm">Detalhes dos não encontrados:</h4>
                  <div className="space-y-2">
                    {updateResult.notFound.map((item, index) => (
                      <div key={index} className="text-sm p-2 bg-muted rounded">
                        <p><strong>Linha {item.line}:</strong> {item.nome}</p>
                        <p className="text-muted-foreground">{item.whatsapp}</p>
                        <p className="text-destructive text-xs mt-1">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {updateResult ? 'Fechar' : 'Cancelar'}
          </Button>
          {!updateResult && (
            <Button
              onClick={handleUpdate}
              disabled={parsedData.length === 0 || validationErrors.length > 0 || isProcessing}
            >
              {isProcessing ? 'Processando...' : 'Atualizar E-mails'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
