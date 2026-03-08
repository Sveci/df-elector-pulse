import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { RegionSelect } from "@/components/office/RegionSelect";
import { useTenantLocationConfig } from "@/hooks/useTenantLocationConfig";
import { useBrazilCities, useBrazilDistricts } from "@/hooks/useBrazilCities";
import { ESTADOS_BR } from "@/constants/brazilPolitics";

interface LocationSelectProps {
  /** For RA mode: the office_cities UUID */
  value?: string;
  onValueChange: (value: string) => void;
  /** For text-based modes (bairro/cidade/estado_cidade): the text value */
  textValue?: string;
  onTextValueChange?: (value: string) => void;
  /** For estado_cidade mode: the selected estado */
  estadoValue?: string;
  onEstadoValueChange?: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  showLabel?: boolean;
}

export function LocationSelect({
  value,
  onValueChange,
  textValue,
  onTextValueChange,
  estadoValue,
  onEstadoValueChange,
  label: labelOverride,
  placeholder: placeholderOverride,
  required = false,
  disabled = false,
  showLabel = false,
}: LocationSelectProps) {
  const config = useTenantLocationConfig();

  // For estado_cidade mode, track local estado selection
  const [localEstado, setLocalEstado] = useState(estadoValue || "");

  useEffect(() => {
    if (estadoValue) setLocalEstado(estadoValue);
  }, [estadoValue]);

  const effectiveLabel = labelOverride || config.label;
  const effectivePlaceholder = placeholderOverride || config.placeholder;

  // For cidade mode: use tenant's fixed estado
  const cidadeUf = config.fieldType === 'cidade' ? config.estado : 
                   config.fieldType === 'estado_cidade' ? localEstado : undefined;
  const { data: cities, isLoading: citiesLoading } = useBrazilCities(
    (config.fieldType === 'cidade' || config.fieldType === 'estado_cidade') ? (cidadeUf || undefined) : undefined
  );

  // For bairro mode: use tenant's fixed estado + cidade to get districts
  const { data: districts, isLoading: districtsLoading } = useBrazilDistricts(
    config.fieldType === 'bairro' ? (config.estado || undefined) : undefined,
    config.fieldType === 'bairro' ? (config.cidade || undefined) : undefined
  );

  if (config.isLoading) {
    return (
      <div className="space-y-2">
        {showLabel && <Label>{effectiveLabel}{required && " *"}</Label>}
        <div className="flex items-center justify-center h-10 border rounded-md bg-muted">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // RA mode: use existing RegionSelect
  if (config.fieldType === 'ra') {
    return (
      <RegionSelect
        value={value}
        onValueChange={onValueChange}
        label={effectiveLabel}
        placeholder={effectivePlaceholder}
        required={required}
        disabled={disabled}
        showLabel={showLabel}
      />
    );
  }

  // Bairro mode: show districts or free text input
  if (config.fieldType === 'bairro') {
    const hasDistricts = districts && districts.length > 1;

    if (districtsLoading) {
      return (
        <div className="space-y-2">
          {showLabel && <Label>{effectiveLabel}{required && " *"}</Label>}
          <div className="flex items-center justify-center h-10 border rounded-md bg-muted">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        </div>
      );
    }

    if (hasDistricts) {
      return (
        <div className="space-y-2">
          {showLabel && <Label>{effectiveLabel}{required && " *"}</Label>}
          <Select
            value={textValue || ""}
            onValueChange={(v) => onTextValueChange?.(v)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o bairro/distrito" />
            </SelectTrigger>
            <SelectContent>
              {districts.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Fallback: free text input for bairro
    return (
      <div className="space-y-2">
        {showLabel && <Label>{effectiveLabel}{required && " *"}</Label>}
        <Input
          value={textValue || ""}
          onChange={(e) => onTextValueChange?.(e.target.value)}
          placeholder="Digite o bairro"
          disabled={disabled}
        />
      </div>
    );
  }

  // Cidade mode: show IBGE cities for the tenant's estado
  if (config.fieldType === 'cidade') {
    if (citiesLoading) {
      return (
        <div className="space-y-2">
          {showLabel && <Label>{effectiveLabel}{required && " *"}</Label>}
          <div className="flex items-center justify-center h-10 border rounded-md bg-muted">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {showLabel && <Label>{effectiveLabel}{required && " *"}</Label>}
        <Select
          value={textValue || ""}
          onValueChange={(v) => onTextValueChange?.(v)}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione a cidade" />
          </SelectTrigger>
          <SelectContent>
            {(cities || []).map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Estado + Cidade mode: show estado select, then cidade select
  if (config.fieldType === 'estado_cidade') {
    return (
      <div className="space-y-3">
        {showLabel && <Label>{effectiveLabel}{required && " *"}</Label>}
        <Select
          value={localEstado}
          onValueChange={(v) => {
            setLocalEstado(v);
            onEstadoValueChange?.(v);
            // Clear city when estado changes
            onTextValueChange?.("");
          }}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o estado" />
          </SelectTrigger>
          <SelectContent>
            {ESTADOS_BR.map((e) => (
              <SelectItem key={e.uf} value={e.uf}>
                {e.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {localEstado && (
          <div className="space-y-2">
            {citiesLoading ? (
              <div className="flex items-center justify-center h-10 border rounded-md bg-muted">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select
                value={textValue || ""}
                onValueChange={(v) => onTextValueChange?.(v)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a cidade" />
                </SelectTrigger>
                <SelectContent>
                  {(cities || []).map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}
