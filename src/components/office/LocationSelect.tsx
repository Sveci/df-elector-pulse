import { useState, useEffect } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { RegionSelect } from "@/components/office/RegionSelect";
import { useTenantLocationConfig } from "@/hooks/useTenantLocationConfig";
import { useBrazilCities, useBrazilDistricts } from "@/hooks/useBrazilCities";
import { ESTADOS_BR } from "@/constants/brazilPolitics";
import { usePublicOrganization } from "@/hooks/usePublicOrganization";

export interface LocationValue {
  cidadeId?: string;
  localidade?: string;
}

interface LocationSelectProps {
  value?: string;
  localidadeValue?: string;
  onLocationChange: (location: LocationValue) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  showLabel?: boolean;
  /** For public pages: pass the tenant_id to resolve org config without auth context */
  tenantId?: string | null;
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
  tenantId,
}: LocationSelectProps) {
  const { data: publicOrg, isLoading: publicOrgLoading } = usePublicOrganization(tenantId);
  const config = useTenantLocationConfig(
    tenantId ? publicOrg : undefined,
    tenantId ? publicOrgLoading : undefined,
  );
  const [selectedEstado, setSelectedEstado] = useState("");
  const [selectedCidade, setSelectedCidade] = useState(localidadeValue || "");

  useEffect(() => {
    if (localidadeValue !== undefined) {
      if (config.fieldType === "estado_cidade" && localidadeValue) {
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

  const cidadeUf =
    config.fieldType === "cidade"
      ? config.estado
      : config.fieldType === "estado_cidade"
        ? selectedEstado
        : undefined;

  const { data: cities, isLoading: citiesLoading } = useBrazilCities(
    config.fieldType === "cidade" || config.fieldType === "estado_cidade"
      ? cidadeUf || undefined
      : undefined
  );

  const { data: districts, isLoading: districtsLoading } = useBrazilDistricts(
    config.fieldType === "bairro" ? config.estado || undefined : undefined,
    config.fieldType === "bairro" ? config.cidade || undefined : undefined
  );

  if (config.isLoading) {
    return <LoadingField label={showLabel ? effectiveLabel : undefined} required={required} />;
  }

  // RA mode
  if (config.fieldType === "ra") {
    return (
      <RegionSelect
        value={value}
        onValueChange={(id) =>
          onLocationChange({ cidadeId: id, localidade: undefined })
        }
        label={effectiveLabel}
        placeholder={effectivePlaceholder}
        required={required}
        disabled={disabled}
        showLabel={showLabel}
      />
    );
  }

  // Bairro mode
  if (config.fieldType === "bairro") {
    if (districtsLoading) {
      return <LoadingField label={showLabel ? effectiveLabel : undefined} required={required} />;
    }

    const hasDistricts = districts && districts.length > 1;
    if (hasDistricts) {
      return (
        <div className="space-y-2">
          {showLabel && <Label>{effectiveLabel}{required && " *"}</Label>}
          <NativeSelect
            value={selectedCidade}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedCidade(v);
              onLocationChange({ cidadeId: undefined, localidade: v });
            }}
            placeholder="Selecione o bairro/distrito"
            options={districts}
            disabled={disabled}
          />
        </div>
      );
    }

    // Fallback: free text for bairro if no districts from IBGE
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
  if (config.fieldType === "cidade") {
    if (citiesLoading) {
      return <LoadingField label={showLabel ? effectiveLabel : undefined} required={required} />;
    }

    return (
      <div className="space-y-2">
        {showLabel && <Label>{effectiveLabel}{required && " *"}</Label>}
        <NativeSelect
          value={selectedCidade}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedCidade(v);
            onLocationChange({ cidadeId: undefined, localidade: v });
          }}
          placeholder="Selecione a cidade"
          options={cities || []}
          disabled={disabled}
        />
      </div>
    );
  }

  // Estado + Cidade mode
  if (config.fieldType === "estado_cidade") {
    const estadoOptions = ESTADOS_BR.map((e) => ({ value: e.uf, label: e.nome }));

    return (
      <div className="space-y-3">
        {showLabel && <Label>{effectiveLabel}{required && " *"}</Label>}
        <NativeSelect
          value={selectedEstado}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedEstado(v);
            setSelectedCidade("");
            onLocationChange({ cidadeId: undefined, localidade: "" });
          }}
          placeholder="Selecione o estado"
          options={estadoOptions}
          disabled={disabled}
        />

        {selectedEstado && (
          <div className="space-y-2">
            {citiesLoading ? (
              <LoadingField />
            ) : (
              <NativeSelect
                value={selectedCidade}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedCidade(v);
                  onLocationChange({
                    cidadeId: undefined,
                    localidade: `${selectedEstado} - ${v}`,
                  });
                }}
                placeholder="Selecione a cidade"
                options={(cities || []).map((c) => ({ value: c.value, label: c.label }))}
                disabled={disabled}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// --- Helper components ---

function LoadingField({ label, required }: { label?: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      {label && <Label>{label}{required && " *"}</Label>}
      <div className="flex items-center justify-center h-10 border rounded-md bg-muted">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}
