import { useState, useEffect } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { useOfficeCitiesByType } from "@/hooks/office/useOfficeCities";
import { Loader2 } from "lucide-react";

interface RegionSelectProps {
  value?: string;
  onValueChange: (cityId: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  showLabel?: boolean;
}

const ENTORNO_OPTION_VALUE = "__ENTORNO__";

export function RegionSelect({
  value,
  onValueChange,
  label = "Cidade/RA",
  placeholder = "Selecione a cidade/RA",
  required = false,
  disabled = false,
  showLabel = false,
}: RegionSelectProps) {
  const { dfCities, entornoCities, isLoading, data: allCities } = useOfficeCitiesByType();
  const [showEntornoSelect, setShowEntornoSelect] = useState(false);
  const [selectedEntornoId, setSelectedEntornoId] = useState("");

  useEffect(() => {
    if (value && allCities) {
      const city = allCities.find(c => c.id === value);
      if (city?.tipo === 'ENTORNO') {
        setShowEntornoSelect(true);
        setSelectedEntornoId(value);
      } else {
        setShowEntornoSelect(false);
        setSelectedEntornoId("");
      }
    }
  }, [value, allCities]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {showLabel && <Label>{label}{required && " *"}</Label>}
        <div className="flex items-center justify-center h-10 border rounded-md bg-muted">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const mainSelectValue = showEntornoSelect ? ENTORNO_OPTION_VALUE : (value || "");

  // Build options: DF cities + separator-like entorno option
  const mainOptions = [
    ...dfCities.map((city) => ({
      value: city.id,
      label: `${city.nome} (${city.codigo_ra})`,
    })),
    ...(entornoCities.length > 0
      ? [{ value: ENTORNO_OPTION_VALUE, label: "📍 Moro no Entorno" }]
      : []),
  ];

  const entornoOptions = entornoCities.map((city) => ({
    value: city.id,
    label: city.nome,
  }));

  const handleMainChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    if (selectedValue === ENTORNO_OPTION_VALUE) {
      setShowEntornoSelect(true);
      setSelectedEntornoId("");
    } else {
      setShowEntornoSelect(false);
      setSelectedEntornoId("");
      onValueChange(selectedValue);
    }
  };

  const handleEntornoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const entornoId = e.target.value;
    setSelectedEntornoId(entornoId);
    onValueChange(entornoId);
  };

  return (
    <div className="space-y-3">
      {showLabel && <Label>{label}{required && " *"}</Label>}

      <NativeSelect
        value={mainSelectValue}
        onChange={handleMainChange}
        placeholder={placeholder}
        options={mainOptions}
        disabled={disabled}
      />

      {showEntornoSelect && entornoCities.length > 0 && (
        <div className="space-y-2">
          {showLabel && (
            <Label className="text-sm text-muted-foreground">
              Qual cidade do Entorno?{required && " *"}
            </Label>
          )}
          <NativeSelect
            value={selectedEntornoId}
            onChange={handleEntornoChange}
            placeholder="Selecione a cidade do Entorno"
            options={entornoOptions}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
