import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, Code } from "lucide-react";
import { toast } from "sonner";
import { generateEventUrl } from "@/lib/eventUrlHelper";
import { useTenantDomain } from "@/hooks/useTenantDomain";

interface EventEmbedCodeDialogProps {
  event: { slug: string; name: string };
  affiliateToken?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventEmbedCodeDialog({ event, affiliateToken, open, onOpenChange }: EventEmbedCodeDialogProps) {
  const tenantDomain = useTenantDomain();
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const embedUrl = `${generateEventUrl(event.slug, tenantDomain).replace(/\/eventos\//, "/eventos/embed/")}`
    + (affiliateToken ? `?ref=${affiliateToken}` : "");

  const iframeCode = `<iframe
  src="${embedUrl}"
  width="100%"
  height="600"
  frameborder="0"
  style="border: none; max-width: 500px;"
  title="Inscrição - ${event.name}"
  id="eleitor360-embed-${event.slug}"
></iframe>
<script>
  window.addEventListener("message", function(e) {
    if (e.data && e.data.type === "eleitor360-embed-height") {
      var iframe = document.getElementById("eleitor360-embed-${event.slug}");
      if (iframe) iframe.style.height = e.data.height + "px";
    }
  });
</script>`;

  const jsCode = `<div id="eleitor360-form-${event.slug}"></div>
<script>
  (function() {
    var container = document.getElementById("eleitor360-form-${event.slug}");
    var iframe = document.createElement("iframe");
    iframe.src = "${embedUrl}";
    iframe.style.width = "100%";
    iframe.style.maxWidth = "500px";
    iframe.style.border = "none";
    iframe.style.height = "600px";
    iframe.title = "Inscrição - ${event.name}";
    iframe.id = "eleitor360-iframe-${event.slug}";
    container.appendChild(iframe);
    window.addEventListener("message", function(e) {
      if (e.data && e.data.type === "eleitor360-embed-height") {
        iframe.style.height = e.data.height + "px";
      }
    });
  })();
</script>`;

  const handleCopy = (code: string, tab: string) => {
    navigator.clipboard.writeText(code);
    setCopiedTab(tab);
    toast.success("Código copiado!");
    setTimeout(() => setCopiedTab(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Código para Embed - {event.name}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Use um dos códigos abaixo para incorporar o formulário de inscrição em outras páginas ou sites.
        </p>

        <Tabs defaultValue="iframe" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="iframe">iFrame</TabsTrigger>
            <TabsTrigger value="javascript">JavaScript</TabsTrigger>
          </TabsList>

          <TabsContent value="iframe" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">
              Cole este código HTML na página onde deseja exibir o formulário. A altura será ajustada automaticamente.
            </p>
            <div className="relative">
              <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">
                {iframeCode}
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={() => handleCopy(iframeCode, "iframe")}
              >
                {copiedTab === "iframe" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="javascript" className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">
              Cole este snippet JavaScript na página. O formulário será criado automaticamente dentro do container.
            </p>
            <div className="relative">
              <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">
                {jsCode}
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={() => handleCopy(jsCode, "js")}
              >
                {copiedTab === "js" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="bg-muted/50 rounded-lg p-3 mt-2">
          <p className="text-xs font-medium mb-1">Preview da URL do formulário:</p>
          <code className="text-xs text-primary break-all">{embedUrl}</code>
        </div>
      </DialogContent>
    </Dialog>
  );
}
