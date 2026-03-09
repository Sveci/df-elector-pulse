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

export interface LocationValue {
  /** UUID from office_cities (RA mode only) */
  cidadeId?: string;
  /** Text location: bairro name, city name, or "UF - Cidade" */
  localidade?: string;
}

interface LocationSelectProps {
  /** Current cidade_id value (for RA mode backward compat) */
  value?: string;
  /** Current localidade text value */
  localidadeValue?: string;
  /** Called when location changes - provides both cidade_id and localidade */
  onLocationChange: (location: LocationValue) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  showLabel?: boolean;
}

export function LocationSelect({
  value,
  localidadeValue,
  onLocationChange,
  label: labelOverride,
  placeholder: placeholderOverride,
  required = false,
  disabled = false,
  showLabel = false,
}: LocationSelectProps) {
  const config = useTenantLocationConfig();
  const [selectedEstado, setSelectedEstado] = useState("");
  const [selectedCidade, setSelectedCidade] = useState(localidadeValue || "");

  useEffect(() => {
    if (localidadeValue !== undefined) {
      // For estado_cidade mode, parse "UF - Cidade" format
      if (config.fieldType === 'estado_cidade' && localidadeValue) {
        const parts = localidadeValue.split(" - ");
        if (parts.length >= 2) {
          setSelectedEstado(parts[0]);
          setSelectedCidade(parts.slice(1).join(" - "));
        }
      } else {
        setSelectedCidade(localidadeValue || "");
      }
    }
  }, [localidadeValue, config.fieldType]);

  const effectiveLabel = labelOverride || config.label;
  const effectivePlaceholder = placeholderOverride || config.placeholder;

  // For cidade mode: use tenant's fixed estado
  const cidadeUf = config.fieldType === 'cidade' ? config.estado :
                   config.fieldType === 'estado_cidade' ? selectedEstado : undefined;
  const { data: cities, isLoading: citiesLoading } = useBrazilCities(
    (config.fieldType === 'cidade' || config.fieldType === 'estado_cidade') ? (cidadeUf || undefined) : undefined
  );

  // For bairro mode: get districts
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

  // RA mode: delegate to existing RegionSelect
  if (config.fieldType === 'ra') {
    return (
      <RegionSelect
        value={value}
        onValueChange={(id) => onLocationChange({ cidadeId: id, localidade: undefined })}
        label={effectiveLabel}
        placeholder={effectivePlaceholder}
        required={required}
        disabled={disabled}
        showLabel={showLabel}
      />
    );
  }

  // Bairro mode
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
            value={selectedCidade}
            onValueChange={(v) => {
              setSelectedCidade(v);
              onLocationChange({ cidadeId: undefined, localidade: v });
            }}
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

    return (
      <div className="space-y-2">
        {showLabel && <Label>{effectiveLabel}{required && " *"}</Label>}
        <Input
          value={selectedCidade}
          onChange={(e) => {
            setSelectedCidade(e.target.value);
            onLocationChange({ cidadeId: undefined, localidade: e.target.value });
          }}
          placeholder="Digite o bairro"
          disabled={disabled}
        />
      </div>
    );
  }

  // Cidade mode
  if (config.fieldType === 'cidade') {
    const citiesFailed = !citiesLoading && (!cities || cities.length === 0) && !!cidadeUf;

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

    // Fallback to text input if API failed
    if (citiesFailed) {
      return (
        <div className="space-y-2">
          {showLabel && <Label>{effectiveLabel}{required && " *"}</Label>}
          <Input
            value={selectedCidade}
            onChange={(e) => {
              setSelectedCidade(e.target.value);
              onLocationChange({ cidadeId: undefined, localidade: e.target.value });
            }}
            placeholder="Digite o nome da cidade"
            disabled={disabled}
          />
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {showLabel && <Label>{effectiveLabel}{required && " *"}</Label>}
        <Select
          value={selectedCidade}
          onValueChange={(v) => {
            setSelectedCidade(v);
            onLocationChange({ cidadeId: undefined, localidade: v });
          }}
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

  // Estado + Cidade mode
  if (config.fieldType === 'estado_cidade') {
    return (
      <div className="space-y-3">
        {showLabel && <Label>{effectiveLabel}{required && " *"}</Label>}
        <Select
          value={selectedEstado}
          onValueChange={(v) => {
            setSelectedEstado(v);
            setSelectedCidade("");
            onLocationChange({ cidadeId: undefined, localidade: "" });
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

        {selectedEstado && (
          <div className="space-y-2">
            {citiesLoading ? (
              <div className="flex items-center justify-center h-10 border rounded-md bg-muted">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select
                value={selectedCidade}
                onValueChange={(v) => {
                  setSelectedCidade(v);
                  onLocationChange({ cidadeId: undefined, localidade: `${selectedEstado} - ${v}` });
                }}
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
