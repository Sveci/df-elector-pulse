import { Circle, Loader2, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface ZapiConnectionIndicatorProps {
  isConnected: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  phone?: string;
}

export function ZapiConnectionIndicator({
  isConnected,
  isLoading,
  isConfigured,
  phone
}: ZapiConnectionIndicatorProps) {
  if (!isConfigured) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Verificando...</span>
      </div>
    );
  }

  const formatPhone = (raw: string) => {
    // Try to format as Brazilian phone: +55 (XX) XXXXX-XXXX
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 13 && digits.startsWith("55")) {
      const ddd = digits.slice(2, 4);
      const part1 = digits.slice(4, 9);
      const part2 = digits.slice(9, 13);
      return `+55 (${ddd}) ${part1}-${part2}`;
    }
    if (digits.length >= 10) {
      return `+${digits}`;
    }
    return raw;
  };

  return (
    <div className="flex flex-col gap-1">
      <div className={cn(
        "flex items-center gap-1.5 text-sm font-medium",
        isConnected ? "text-green-600" : "text-red-500"
      )}>
        <Circle className={cn(
          "h-3 w-3 fill-current",
          isConnected ? "text-green-500" : "text-red-500"
        )} />
        <span>{isConnected ? "Conectado" : "Desconectado"}</span>
      </div>
      {isConnected && phone && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="h-3 w-3" />
          <span>{formatPhone(phone)}</span>
        </div>
      )}
    </div>
  );
}
