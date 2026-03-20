import { Badge } from "@/components/ui/badge";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

interface ProtocolBadgeProps {
  protocolo: string;
  showCopy?: boolean;
  className?: string;
}

export function ProtocolBadge({ protocolo, showCopy = true, className }: ProtocolBadgeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(protocolo);
      setCopied(true);
      toast.success("Protocolo copiado!");

      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Erro ao copiar protocolo");
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge variant="secondary" className="font-mono text-sm">
        {protocolo}
      </Badge>

      {showCopy && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCopy}
          aria-label="Copiar protocolo"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      )}
    </div>
  );
}
