import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useOfficeCitiesByType } from "@/hooks/office/useOfficeCities";
import { Loader2, MapPin, ChevronDown, Check, ArrowLeft } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showEntornoDrawer, setShowEntornoDrawer] = useState(false);
  const isMobile = useIsMobile();

  // Determinar se o valor atual é do Entorno
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

  // Get selected city name for display
  const getSelectedCityName = () => {
    if (!value) return null;
    const city = allCities?.find(c => c.id === value);
    if (!city) return null;
    return city.tipo === 'ENTORNO' ? city.nome : `${city.nome} (${city.codigo_ra})`;
  };

  const handleMainSelectChange = (selectedValue: string) => {
    if (selectedValue === ENTORNO_OPTION_VALUE) {
      setShowEntornoSelect(true);
      setSelectedEntornoId("");
    } else {
      setShowEntornoSelect(false);
      setSelectedEntornoId("");
      onValueChange(selectedValue);
    }
  };

  const handleEntornoSelectChange = (entornoId: string) => {
    setSelectedEntornoId(entornoId);
    onValueChange(entornoId);
  };

  // Mobile handlers
  const handleMobileCitySelect = (cityId: string) => {
    setShowEntornoSelect(false);
    setSelectedEntornoId("");
    onValueChange(cityId);
    setDrawerOpen(false);
  };

  const handleMobileEntornoClick = () => {
    setShowEntornoDrawer(true);
  };

  const handleMobileEntornoSelect = (cityId: string) => {
    setShowEntornoSelect(true);
    setSelectedEntornoId(cityId);
    onValueChange(cityId);
    setShowEntornoDrawer(false);
    setDrawerOpen(false);
  };

  const handleBackFromEntorno = () => {
    setShowEntornoDrawer(false);
  };

  // Determinar o valor a ser exibido no select principal
  const mainSelectValue = showEntornoSelect ? ENTORNO_OPTION_VALUE : value;

  // Mobile: Use Drawer
  if (isMobile) {
    return (
      <div className="space-y-3">
        {showLabel && <Label>{label}{required && " *"}</Label>}

        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between font-normal"
              disabled={disabled}
            >
              <span className={!value ? "text-muted-foreground" : ""}>
                {getSelectedCityName() || placeholder}
              </span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="border-b">
              <DrawerTitle>Selecione sua Cidade/RA</DrawerTitle>
            </DrawerHeader>
            <ScrollArea className="h-[60vh]">
              <div className="p-2 space-y-1">
                {dfCities.map((city) => (
                  <div
                    key={city.id}
                    onClick={() => handleMobileCitySelect(city.id)}
                    className="flex items-center justify-between px-4 py-3 rounded-md cursor-pointer hover:bg-accent active:bg-accent"
                  >
                    <span>{city.nome} ({city.codigo_ra})</span>
                    {value === city.id && <Check className="h-4 w-4 text-primary" />}
                  </div>
                ))}

                {entornoCities.length > 0 && (
                  <>
                    <div className="my-2 border-t" />
                    <div
                      onClick={handleMobileEntornoClick}
                      className="flex items-center gap-2 px-4 py-3 rounded-md cursor-pointer hover:bg-accent active:bg-accent"
                    >
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>Moro no Entorno</span>
                      {showEntornoSelect && <Check className="h-4 w-4 text-primary ml-auto" />}
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </DrawerContent>
        </Drawer>

        {/* Drawer secundário para cidades do Entorno */}
        <Drawer open={showEntornoDrawer} onOpenChange={setShowEntornoDrawer}>
          <DrawerContent>
            <DrawerHeader className="border-b">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleBackFromEntorno}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <DrawerTitle>Qual cidade do Entorno?</DrawerTitle>
              </div>
            </DrawerHeader>
            <ScrollArea className="h-[50vh]">
              <div className="p-2 space-y-1">
                {entornoCities.map((city) => (
                  <div
                    key={city.id}
                    onClick={() => handleMobileEntornoSelect(city.id)}
                    className="flex items-center justify-between px-4 py-3 rounded-md cursor-pointer hover:bg-accent active:bg-accent"
                  >
                    <span>{city.nome}</span>
                    {selectedEntornoId === city.id && <Check className="h-4 w-4 text-primary" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  // Desktop: Keep original Select behavior
  return (
    <div className="space-y-3">
      {showLabel && <Label>{label}{required && " *"}</Label>}

      <Select
        value={mainSelectValue || ""}
        onValueChange={handleMainSelectChange}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {dfCities.map((city) => (
            <SelectItem key={city.id} value={city.id}>
              {city.nome} ({city.codigo_ra})
            </SelectItem>
          ))}

          {entornoCities.length > 0 && (
            <>
              <div className="my-1 border-t" />
              <SelectItem value={ENTORNO_OPTION_VALUE}>
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Moro no Entorno
                </span>
              </SelectItem>
            </>
          )}
        </SelectContent>
      </Select>

      {showEntornoSelect && entornoCities.length > 0 && (
        <div className="space-y-2">
          {showLabel && <Label className="text-sm text-muted-foreground">Qual cidade do Entorno?{required && " *"}</Label>}
          <Select
            value={selectedEntornoId}
            onValueChange={handleEntornoSelectChange}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a cidade do Entorno" />
            </SelectTrigger>
            <SelectContent>
              {entornoCities.map((city) => (
                <SelectItem key={city.id} value={city.id}>
                  {city.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
