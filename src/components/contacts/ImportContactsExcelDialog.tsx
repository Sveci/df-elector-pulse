import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, Download, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  parseContactsExcelFile,
  generateContactsTemplate,
  validateContactImportData,
  ContactImportRow,
} from "@/utils/excelParser";
import { useImportContacts } from "@/hooks/contacts/useImportContacts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export function ImportContactsExcelDialog() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ContactImportRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
    percentage: 0
  });

  const importMutation = useImportContacts();

  // Simular progresso em tempo real durante a importação
  useEffect(() => {
    if (importMutation.isPending && parsedData.length > 0) {
      const total = parsedData.length;
      const estimatedTimePerContact = 400; // 400ms por contato
      const totalTime = total * estimatedTimePerContact;
      const updateInterval = 100; // Atualizar a cada 100ms
      const maxProgress = 95; // Parar em 95% até resposta real

      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += updateInterval;
        const progress = Math.min((elapsed / totalTime) * 100, maxProgress);
        const current = Math.floor((progress / 100) * total);

        setImportProgress({
          current,
          total,
          percentage: Math.floor(progress)
        });

        if (progress >= maxProgress) {
          clearInterval(interval);
        }
      }, updateInterval);

      return () => clearInterval(interval);
    } else {
      setImportProgress({ current: 0, total: 0, percentage: 0 });
    }
  }, [importMutation.isPending, parsedData.length]);

  const handleDownloadTemplate = () => {
    generateContactsTemplate();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validar extensão
    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      alert('Por favor, selecione um arquivo Excel (.xlsx ou .xls)');
      return;
    }

    // Validar tamanho (10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      alert('Arquivo muito grande. Máximo: 10MB');
      return;
    }

    setFile(selectedFile);
    setImportResult(null);

    try {
      const data = await parseContactsExcelFile(selectedFile);
      const validation = validateContactImportData(data);

      setParsedData(data);
      setValidationErrors(validation.errors);
    } catch (error) {
      alert(`Erro ao processar arquivo: ${error}`);
      setFile(null);
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0 || validationErrors.length > 0) return;

    const result = await importMutation.mutateAsync(parsedData as any);

    // Completar progresso para 100%
    setImportProgress({
      current: parsedData.length,
      total: parsedData.length,
      percentage: 100
    });

    setImportResult(result);

    if (result.success) {
      setTimeout(() => {
        handleClose();
      }, 3000);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setFile(null);
      setParsedData([]);
      setValidationErrors([]);
      setImportResult(null);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Importar Contatos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Importar Contatos via Excel</DialogTitle>
          <DialogDescription>
            Faça o upload de um arquivo Excel (.xlsx ou .xls) com os dados dos contatos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download Template */}
          <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">Baixar modelo de planilha</p>
              <p className="text-xs text-muted-foreground">
                Use este modelo para garantir que os dados estão no formato correto
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
          </div>

          {/* File Upload */}
          <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Clique para selecionar o arquivo</p>
              <p className="text-xs text-muted-foreground mt-1">
                Apenas arquivos .xlsx ou .xls (máx. 10MB)
              </p>
            </label>
            {file && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{file.name}</span>
              </div>
            )}
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">Erros encontrados na planilha:</div>
                <ScrollArea className="h-32">
                  <ul className="text-sm space-y-1">
                    {validationErrors.map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                  </ul>
                </ScrollArea>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview Data */}
          {parsedData.length > 0 && validationErrors.length === 0 && !importResult && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium">
                  Preview dos dados ({parsedData.length} contatos)
                </h4>
                <Badge variant="outline">{parsedData.length} linhas</Badge>
              </div>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {parsedData.slice(0, 5).map((row, idx) => (
                    <div key={idx} className="text-xs p-2 bg-muted rounded">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="font-medium">Nome:</span> {row.nome_completo}
                        </div>
                        <div>
                          <span className="font-medium">WhatsApp:</span> {row.whatsapp}
                        </div>
                        <div>
                          <span className="font-medium">Data Nasc:</span> {row.data_nascimento}
                        </div>
                        <div>
                          <span className="font-medium">Cidade:</span> {row.cidade || 'Padrão'}
                        </div>
                      </div>
                    </div>
                  ))}
                  {parsedData.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      ... e mais {parsedData.length - 5} contatos
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Import Progress */}
          {importMutation.isPending && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm font-medium">Importando contatos...</span>
                </div>
                <Badge variant="secondary" className="font-mono">
                  {importProgress.current} / {importProgress.total}
                </Badge>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Processados: {importProgress.current}</span>
                  <span>Restantes: {importProgress.total - importProgress.current}</span>
                </div>
                <Progress value={importProgress.percentage} className="w-full h-2" />
                <p className="text-xs text-center text-muted-foreground">
                  {importProgress.percentage}% concluído
                </p>
              </div>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className="space-y-3">
              {/* Success or Partial Success */}
              <Alert variant={importResult.success && importResult.errors.filter((e: any) => !e.error.includes('duplicado')).length === 0 ? "default" : "destructive"}>
                {importResult.success && importResult.errors.filter((e: any) => !e.error.includes('duplicado')).length === 0 ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  <div className="font-medium mb-2">
                    {importResult.success && importResult.errors.filter((e: any) => !e.error.includes('duplicado')).length === 0
                      ? "✅ Importação concluída com sucesso!"
                      : "⚠️ Importação concluída com problemas"}
                  </div>
                  <div className="text-sm space-y-1">
                    <p>✓ {importResult.inserted} contatos inseridos</p>
                    <p>↻ {importResult.updated} contatos atualizados</p>
                    {importResult.errors && importResult.errors.length > 0 && (
                      <>
                        {importResult.errors.filter((e: any) => e.error.includes('duplicado')).length > 0 && (
                          <p className="text-yellow-600">⚠ {importResult.errors.filter((e: any) => e.error.includes('duplicado')).length} duplicados ignorados</p>
                        )}
                        {importResult.errors.filter((e: any) => !e.error.includes('duplicado')).length > 0 && (
                          <p className="text-destructive">✗ {importResult.errors.filter((e: any) => !e.error.includes('duplicado')).length} erros críticos</p>
                        )}
                      </>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

              {/* Warnings Section (Duplicates) */}
              {importResult.errors && importResult.errors.filter((e: any) => e.error.includes('duplicado')).length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-yellow-700 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Telefones duplicados ignorados ({importResult.errors.filter((e: any) => e.error.includes('duplicado')).length})
                  </p>
                  <ScrollArea className="h-24 rounded border border-yellow-200 p-2 bg-yellow-50">
                    <div className="space-y-1.5">
                      {importResult.errors
                        .filter((e: any) => e.error.includes('duplicado'))
                        .map((error: any, idx: number) => (
                          <div key={idx} className="text-xs p-1.5 bg-yellow-100 rounded border border-yellow-200">
                            <span className="font-mono font-bold text-yellow-800">Linha {error.line}:</span>
                            <span className="ml-2 text-yellow-700">{error.error}</span>
                          </div>
                        ))
                      }
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Critical Errors Section */}
              {importResult.errors && importResult.errors.filter((e: any) => !e.error.includes('duplicado')).length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Erros críticos encontrados ({importResult.errors.filter((e: any) => !e.error.includes('duplicado')).length})
                  </p>
                  <ScrollArea className="h-32 rounded border border-destructive p-2 bg-destructive/5">
                    <div className="space-y-2">
                      {importResult.errors
                        .filter((e: any) => !e.error.includes('duplicado'))
                        .map((error: any, idx: number) => (
                          <div key={idx} className="text-xs p-2 bg-destructive/10 rounded border border-destructive/20">
                            <span className="font-mono font-bold text-destructive">Linha {error.line}:</span>
                            <span className="ml-2">{error.error}</span>
                          </div>
                        ))
                      }
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importMutation.isPending}>
            {importResult ? "Fechar" : "Cancelar"}
          </Button>
          {!importResult && (
            <Button
              onClick={handleImport}
              disabled={
                parsedData.length === 0 ||
                validationErrors.length > 0 ||
                importMutation.isPending
              }
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar {parsedData.length} contatos
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
