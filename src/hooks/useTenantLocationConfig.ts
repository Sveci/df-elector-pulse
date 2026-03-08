import { useOrganization } from "@/hooks/useOrganization";
import { useTenantContext } from "@/contexts/TenantContext";
import { getCargoConfig, getLocationFieldType, type LocationFieldType } from "@/constants/brazilPolitics";

export interface TenantLocationConfig {
  /** What field type to show in forms */
  fieldType: LocationFieldType;
  /** Label for the location field */
  label: string;
  /** Placeholder for the location field */
  placeholder: string;
  /** The tenant's fixed estado (UF) if applicable */
  estado: string | null;
  /** The tenant's fixed cidade if applicable */
  cidade: string | null;
  /** Whether the config is still loading */
  isLoading: boolean;
}

/**
 * Hook that returns location configuration based on the current organization/tenant's cargo.
 * This determines what location field (RA, bairro, cidade, estado+cidade) to show in forms.
 */
export function useTenantLocationConfig(): TenantLocationConfig {
  const { data: organization, isLoading: orgLoading } = useOrganization();

  let tenantLoading = false;
  try {
    const ctx = useTenantContext();
    tenantLoading = ctx.isLoading || (!ctx.activeTenant && ctx.tenants.length === 0 && ctx.isLoading);
  } catch {
    // Outside TenantProvider
  }

  const isLoading = orgLoading || tenantLoading;

  const cargo = organization?.cargo || null;
  const fieldType = getLocationFieldType(cargo);
  const estado = organization?.estado || null;
  const cidade = organization?.cidade || null;

  let label: string;
  let placeholder: string;

  switch (fieldType) {
    case 'bairro':
      label = 'Bairro';
      placeholder = 'Selecione o bairro';
      break;
    case 'cidade':
      label = 'Cidade';
      placeholder = 'Selecione a cidade';
      break;
    case 'estado_cidade':
      label = 'Estado e Cidade';
      placeholder = 'Selecione o estado';
      break;
    case 'ra':
    default:
      label = 'Cidade/RA';
      placeholder = 'Selecione a cidade/RA';
      break;
  }

  return {
    fieldType,
    label,
    placeholder,
    estado,
    cidade,
    isLoading,
  };
}
