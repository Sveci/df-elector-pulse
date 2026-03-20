import { useState } from "react";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseExcelFile, generateLeadersTemplate, validateImportData, type LeaderImportRow } from "@/utils/excelParser";
import { useImportLeaders } from "@/hooks/leaders/useImportLeaders";

export function ImportLeadersDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<LeaderImportRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<any>(null);

  const importMutation = useImportLeaders();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validar extensão
    const validExtensions = ['.xlsx', '.xls'];
    const fileExtension = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));

    if (!validExtensions.includes(fileExtension)) {
      setValidationErrors(['Por favor, selecione um arquivo Excel (.xlsx ou .xls)']);
      return;
    }

    setFile(selectedFile);
    setValidationErrors([]);
    setParsedData([]);
    setImportResult(null);

    try {
      const data = await parseExcelFile(selectedFile);
      const validation = validateImportData(data);

      if (!validation.isValid) {
        setValidationErrors(validation.errors);
        return;
      }

      setParsedData(data);
    } catch (error: any) {
      setValidationErrors([error.message || 'Erro ao processar arquivo']);
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;

    try {
      const result = await importMutation.mutateAsync(parsedData);
      setImportResult(result);

      // Se não houver erros, limpar e fechar após 2 segundos
      if (result.errors.length === 0) {
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Erro na importação:', error);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setFile(null);
    setParsedData([]);
    setValidationErrors([]);
    setImportResult(null);
  };

  const downloadTemplate = () => {
    generateLeadersTemplate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Upload className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Importação em Massa de Líderes</DialogTitle>
          <DialogDescription>
            Faça upload de uma planilha Excel com os dados dos líderes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download do modelo */}
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Baixe o modelo de planilha para preencher os dados corretamente</span>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar Modelo
              </Button>
            </AlertDescription>
          </Alert>

          {/* Upload de arquivo */}
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Clique para selecionar ou arraste um arquivo Excel
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Formatos aceitos: .xlsx, .xls
              </p>
            </label>
            {file && (
              <p className="mt-4 text-sm font-medium">{file.name}</p>
            )}
          </div>

          {/* Erros de validação */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold mb-2">Erros encontrados:</p>
                <ScrollArea className="h-32">
                  <ul className="text-sm space-y-1">
                    {validationErrors.slice(0, 10).map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                    {validationErrors.length > 10 && (
                      <li className="text-muted-foreground">
                        ... e mais {validationErrors.length - 10} erro(s)
                      </li>
                    )}
                  </ul>
                </ScrollArea>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview dos dados */}
          {parsedData.length > 0 && !importResult && (
            <div>
              <h4 className="font-semibold mb-2">
                Preview ({parsedData.length} líder(es) encontrado(s))
              </h4>
              <ScrollArea className="h-48 border rounded-lg p-4">
                <div className="space-y-2">
                  {parsedData.slice(0, 10).map((leader, i) => (
                    <div key={i} className="text-sm border-b pb-2">
                      <p className="font-medium">{leader.nome_completo}</p>
                      <p className="text-muted-foreground text-xs">
                        {leader.whatsapp} • {leader.status}
                        {leader.email && ` • ${leader.email}`}
                      </p>
                    </div>
                  ))}
                  {parsedData.length > 10 && (
                    <p className="text-xs text-muted-foreground">
                      ... e mais {parsedData.length - 10} líder(es)
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Progress durante importação */}
          {importMutation.isPending && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Importando líderes...</span>
              </div>
              <Progress value={undefined} />
            </div>
          )}

          {/* Resultado da importação */}
          {importResult && (
            <Alert variant={importResult.errors.length > 0 ? "default" : "default"}>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold mb-2">Importação concluída!</p>
                <div className="text-sm space-y-1">
                  <p>✓ {importResult.inserted} líder(es) criado(s)</p>
                  <p>✓ {importResult.updated} líder(es) atualizado(s)</p>
                  {importResult.errors.length > 0 && (
                    <>
                      <p className="text-destructive mt-2">
                        ✗ {importResult.errors.length} linha(s) com erro
                      </p>
                      <ScrollArea className="h-32 mt-2">
                        <ul className="text-xs space-y-1">
                          {importResult.errors.map((err: any, i: number) => (
                            <li key={i}>
                              Linha {err.line}: {err.error}
                            </li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Ações */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              {importResult ? 'Fechar' : 'Cancelar'}
            </Button>
            {parsedData.length > 0 && !importResult && (
              <Button
                onClick={handleImport}
                disabled={importMutation.isPending || validationErrors.length > 0}
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar {parsedData.length} Líder(es)
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
