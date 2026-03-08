// Cargos políticos do Brasil com regras de dependência
export interface CargoPolitico {
  value: string;
  label: string;
  requiresEstado: boolean;
  requiresCidade: boolean;
  requiresRA: boolean; // Região Administrativa (só DF)
}

export const CARGOS_POLITICOS: CargoPolitico[] = [
  { value: "presidente", label: "Presidente da República", requiresEstado: false, requiresCidade: false, requiresRA: false },
  { value: "vice_presidente", label: "Vice-Presidente da República", requiresEstado: false, requiresCidade: false, requiresRA: false },
  { value: "senador", label: "Senador(a)", requiresEstado: true, requiresCidade: false, requiresRA: false },
  { value: "governador", label: "Governador(a)", requiresEstado: true, requiresCidade: false, requiresRA: false },
  { value: "vice_governador", label: "Vice-Governador(a)", requiresEstado: true, requiresCidade: false, requiresRA: false },
  { value: "deputado_federal", label: "Deputado(a) Federal", requiresEstado: true, requiresCidade: false, requiresRA: false },
  { value: "deputado_estadual", label: "Deputado(a) Estadual", requiresEstado: true, requiresCidade: false, requiresRA: false },
  { value: "deputado_distrital", label: "Deputado(a) Distrital", requiresEstado: true, requiresCidade: false, requiresRA: true },
  { value: "prefeito", label: "Prefeito(a)", requiresEstado: true, requiresCidade: true, requiresRA: false },
  { value: "vice_prefeito", label: "Vice-Prefeito(a)", requiresEstado: true, requiresCidade: true, requiresRA: false },
  { value: "vereador", label: "Vereador(a)", requiresEstado: true, requiresCidade: true, requiresRA: false },
  { value: "secretario_estadual", label: "Secretário(a) Estadual", requiresEstado: true, requiresCidade: false, requiresRA: false },
  { value: "secretario_municipal", label: "Secretário(a) Municipal", requiresEstado: true, requiresCidade: true, requiresRA: false },
  { value: "administrador_regional", label: "Administrador(a) Regional", requiresEstado: true, requiresCidade: false, requiresRA: true },
  { value: "conselheiro_tutelar", label: "Conselheiro(a) Tutelar", requiresEstado: true, requiresCidade: true, requiresRA: false },
  { value: "outro", label: "Outro", requiresEstado: true, requiresCidade: false, requiresRA: false },
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
