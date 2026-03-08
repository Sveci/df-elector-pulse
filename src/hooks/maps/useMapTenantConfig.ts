import { useMemo } from "react";
import { useOrganization } from "@/hooks/useOrganization";
import { getLocationFieldType, type LocationFieldType } from "@/constants/brazilPolitics";
import { getEstadoCenter, BRAZIL_CENTER, BRAZIL_ZOOM } from "@/data/maps/estadoCenters";

export interface MapTenantConfig {
  /** Center coordinates for the map */
  center: [number, number];
  /** Default zoom level */
  zoom: number;
  /** Label for the region/location filter */
  regionLabel: string;
  /** Subtitle for the map header */
  subtitle: string;
  /** Whether to use office_cities (RA mode) or localidade-based grouping */
  useOfficeCities: boolean;
  /** Location field type from tenant config */
  fieldType: LocationFieldType;
  /** Whether to show RA boundary polygons */
  showRABoundaries: boolean;
  /** Whether config is loading */
  isLoading: boolean;
}

const DF_CENTER: [number, number] = [-15.7801, -47.9292];
const DF_ZOOM = 10;
const CITY_ZOOM = 12;

export function useMapTenantConfig(): MapTenantConfig {
  const { data: organization, isLoading } = useOrganization();

  return useMemo(() => {
    const cargo = organization?.cargo || null;
    const estado = organization?.estado || null;
    const cidade = organization?.cidade || null;
    const fieldType = getLocationFieldType(cargo);

    // RA mode (DF) - keep current behavior
    if (fieldType === 'ra') {
      return {
        center: DF_CENTER,
        zoom: DF_ZOOM,
        regionLabel: "Região Administrativa",
        subtitle: "Visualização da atuação política no Distrito Federal",
        useOfficeCities: true,
        fieldType,
        showRABoundaries: true,
        isLoading,
      };
    }

    // Bairro mode (municipal) - center on city
    if (fieldType === 'bairro') {
      // Try to get state center, then approximate city
      const estadoCenter = estado ? getEstadoCenter(estado) : null;
      return {
        center: estadoCenter ? [estadoCenter.lat, estadoCenter.lng] : DF_CENTER,
        zoom: CITY_ZOOM,
        regionLabel: "Bairro",
        subtitle: cidade && estado
          ? `Visualização da atuação política em ${cidade} - ${estado}`
          : "Visualização da atuação política",
        useOfficeCities: false,
        fieldType,
        showRABoundaries: false,
        isLoading,
      };
    }

    // Cidade mode (state level) - center on state
    if (fieldType === 'cidade') {
      const estadoCenter = estado ? getEstadoCenter(estado) : null;
      return {
        center: estadoCenter ? [estadoCenter.lat, estadoCenter.lng] : DF_CENTER,
        zoom: estadoCenter?.zoom || 8,
        regionLabel: "Cidade",
        subtitle: estado
          ? `Visualização da atuação política no estado de ${estado}`
          : "Visualização da atuação política",
        useOfficeCities: false,
        fieldType,
        showRABoundaries: false,
        isLoading,
      };
    }

    // Estado + Cidade mode (national) - center on Brazil
    return {
      center: BRAZIL_CENTER,
      zoom: BRAZIL_ZOOM,
      regionLabel: "Estado / Cidade",
      subtitle: "Visualização da atuação política nacional",
      useOfficeCities: false,
      fieldType,
      showRABoundaries: false,
      isLoading,
    };
  }, [organization, isLoading]);
}
