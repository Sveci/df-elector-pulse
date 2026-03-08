// Cargos políticos do Brasil com regras de dependência
export interface CargoPolitico {
  value: string;
  label: string;
  requiresEstado: boolean;
  requiresCidade: boolean;
  requiresRA: boolean; // Região Administrativa (só DF)
  /** Tipo de localidade que o form de cadastro de contato/líder deve pedir */
  locationFieldType: LocationFieldType;
}

/**
 * Determina qual campo de localização mostrar nos formulários
 * - 'ra': Região Administrativa (office_cities do DF) - default atual
 * - 'bairro': Bairro (texto livre, para vereadores/prefeitos/cargos municipais)
 * - 'cidade': Cidade via IBGE (para cargos estaduais - governador, deputados, senador)
 * - 'estado_cidade': Estado + Cidade via IBGE (para cargos nacionais - presidente)
 */
export type LocationFieldType = 'ra' | 'bairro' | 'cidade' | 'estado_cidade';

export const CARGOS_POLITICOS: CargoPolitico[] = [
  { value: "presidente", label: "Presidente da República", requiresEstado: false, requiresCidade: false, requiresRA: false, locationFieldType: 'estado_cidade' },
  { value: "vice_presidente", label: "Vice-Presidente da República", requiresEstado: false, requiresCidade: false, requiresRA: false, locationFieldType: 'estado_cidade' },
  { value: "senador", label: "Senador(a)", requiresEstado: true, requiresCidade: false, requiresRA: false, locationFieldType: 'cidade' },
  { value: "governador", label: "Governador(a)", requiresEstado: true, requiresCidade: false, requiresRA: false, locationFieldType: 'cidade' },
  { value: "vice_governador", label: "Vice-Governador(a)", requiresEstado: true, requiresCidade: false, requiresRA: false, locationFieldType: 'cidade' },
  { value: "deputado_federal", label: "Deputado(a) Federal", requiresEstado: true, requiresCidade: false, requiresRA: false, locationFieldType: 'cidade' },
  { value: "deputado_estadual", label: "Deputado(a) Estadual", requiresEstado: true, requiresCidade: false, requiresRA: false, locationFieldType: 'cidade' },
  { value: "deputado_distrital", label: "Deputado(a) Distrital", requiresEstado: true, requiresCidade: false, requiresRA: true, locationFieldType: 'ra' },
  { value: "prefeito", label: "Prefeito(a)", requiresEstado: true, requiresCidade: true, requiresRA: false, locationFieldType: 'bairro' },
  { value: "vice_prefeito", label: "Vice-Prefeito(a)", requiresEstado: true, requiresCidade: true, requiresRA: false, locationFieldType: 'bairro' },
  { value: "vereador", label: "Vereador(a)", requiresEstado: true, requiresCidade: true, requiresRA: false, locationFieldType: 'bairro' },
  { value: "secretario_estadual", label: "Secretário(a) Estadual", requiresEstado: true, requiresCidade: false, requiresRA: false, locationFieldType: 'cidade' },
  { value: "secretario_municipal", label: "Secretário(a) Municipal", requiresEstado: true, requiresCidade: true, requiresRA: false, locationFieldType: 'bairro' },
  { value: "administrador_regional", label: "Administrador(a) Regional", requiresEstado: true, requiresCidade: false, requiresRA: true, locationFieldType: 'ra' },
  { value: "conselheiro_tutelar", label: "Conselheiro(a) Tutelar", requiresEstado: true, requiresCidade: true, requiresRA: false, locationFieldType: 'bairro' },
  { value: "outro", label: "Outro", requiresEstado: true, requiresCidade: false, requiresRA: false, locationFieldType: 'cidade' },
];

export interface EstadoBR {
  uf: string;
  nome: string;
}

export const ESTADOS_BR: EstadoBR[] = [
  { uf: "AC", nome: "Acre" },
  { uf: "AL", nome: "Alagoas" },
  { uf: "AP", nome: "Amapá" },
  { uf: "AM", nome: "Amazonas" },
  { uf: "BA", nome: "Bahia" },
  { uf: "CE", nome: "Ceará" },
  { uf: "DF", nome: "Distrito Federal" },
  { uf: "ES", nome: "Espírito Santo" },
  { uf: "GO", nome: "Goiás" },
  { uf: "MA", nome: "Maranhão" },
  { uf: "MT", nome: "Mato Grosso" },
  { uf: "MS", nome: "Mato Grosso do Sul" },
  { uf: "MG", nome: "Minas Gerais" },
  { uf: "PA", nome: "Pará" },
  { uf: "PB", nome: "Paraíba" },
  { uf: "PR", nome: "Paraná" },
  { uf: "PE", nome: "Pernambuco" },
  { uf: "PI", nome: "Piauí" },
  { uf: "RJ", nome: "Rio de Janeiro" },
  { uf: "RN", nome: "Rio Grande do Norte" },
  { uf: "RS", nome: "Rio Grande do Sul" },
  { uf: "RO", nome: "Rondônia" },
  { uf: "RR", nome: "Roraima" },
  { uf: "SC", nome: "Santa Catarina" },
  { uf: "SP", nome: "São Paulo" },
  { uf: "SE", nome: "Sergipe" },
  { uf: "TO", nome: "Tocantins" },
];

export function getCargoConfig(cargoValue: string): CargoPolitico | undefined {
  return CARGOS_POLITICOS.find(c => c.value === cargoValue);
}

export function getCargoLabel(cargoValue: string): string {
  return CARGOS_POLITICOS.find(c => c.value === cargoValue)?.label || cargoValue;
}

export function getEstadoNome(uf: string): string {
  return ESTADOS_BR.find(e => e.uf === uf)?.nome || uf;
}

/**
 * Returns the location field type based on the organization's cargo.
 * Defaults to 'ra' (current DF behavior) if no cargo is set.
 */
export function getLocationFieldType(cargo: string | null | undefined): LocationFieldType {
  if (!cargo) return 'ra';
  // Try matching by value first, then by label
  const config = getCargoConfig(cargo) || CARGOS_POLITICOS.find(c => c.label.toLowerCase() === cargo.toLowerCase());
  return config?.locationFieldType || 'ra';
}
