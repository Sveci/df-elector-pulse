import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOfficeCities } from "@/hooks/office/useOfficeCities";
import { Loader2 } from "lucide-react";

interface CitySelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CitySelect({ value, onValueChange, placeholder = "Selecione a cidade", disabled }: CitySelectProps) {
  const { data: cities, isLoading } = useOfficeCities();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-10 border rounded-md bg-muted">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {cities?.map((city) => (
          <SelectItem key={city.id} value={city.id}>
            {city.nome} ({city.codigo_ra})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
