// Cargos políticos do Brasil com regras de dependência
export interface CargoPolitico {
  value: string;
  label: string;
  labelMasculino: string;
  labelFeminino: string;
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
  { value: "presidente", label: "Presidente da República", labelMasculino: "Presidente da República", labelFeminino: "Presidenta da República", requiresEstado: false, requiresCidade: false, requiresRA: false, locationFieldType: 'estado_cidade' },
  { value: "vice_presidente", label: "Vice-Presidente da República", labelMasculino: "Vice-Presidente da República", labelFeminino: "Vice-Presidenta da República", requiresEstado: false, requiresCidade: false, requiresRA: false, locationFieldType: 'estado_cidade' },
  { value: "senador", label: "Senador(a)", labelMasculino: "Senador", labelFeminino: "Senadora", requiresEstado: true, requiresCidade: false, requiresRA: false, locationFieldType: 'cidade' },
  { value: "governador", label: "Governador(a)", labelMasculino: "Governador", labelFeminino: "Governadora", requiresEstado: true, requiresCidade: false, requiresRA: false, locationFieldType: 'cidade' },
  { value: "vice_governador", label: "Vice-Governador(a)", labelMasculino: "Vice-Governador", labelFeminino: "Vice-Governadora", requiresEstado: true, requiresCidade: false, requiresRA: false, locationFieldType: 'cidade' },
  { value: "deputado_federal", label: "Deputado(a) Federal", labelMasculino: "Deputado Federal", labelFeminino: "Deputada Federal", requiresEstado: true, requiresCidade: false, requiresRA: false, locationFieldType: 'cidade' },
  { value: "deputado_estadual", label: "Deputado(a) Estadual", labelMasculino: "Deputado Estadual", labelFeminino: "Deputada Estadual", requiresEstado: true, requiresCidade: false, requiresRA: false, locationFieldType: 'cidade' },
  { value: "deputado_distrital", label: "Deputado(a) Distrital", labelMasculino: "Deputado Distrital", labelFeminino: "Deputada Distrital", requiresEstado: true, requiresCidade: false, requiresRA: true, locationFieldType: 'ra' },
  { value: "prefeito", label: "Prefeito(a)", labelMasculino: "Prefeito", labelFeminino: "Prefeita", requiresEstado: true, requiresCidade: true, requiresRA: false, locationFieldType: 'bairro' },
  { value: "vice_prefeito", label: "Vice-Prefeito(a)", labelMasculino: "Vice-Prefeito", labelFeminino: "Vice-Prefeita", requiresEstado: true, requiresCidade: true, requiresRA: false, locationFieldType: 'bairro' },
  { value: "vereador", label: "Vereador(a)", labelMasculino: "Vereador", labelFeminino: "Vereadora", requiresEstado: true, requiresCidade: true, requiresRA: false, locationFieldType: 'bairro' },
  { value: "secretario_estadual", label: "Secretário(a) Estadual", labelMasculino: "Secretário Estadual", labelFeminino: "Secretária Estadual", requiresEstado: true, requiresCidade: false, requiresRA: false, locationFieldType: 'cidade' },
  { value: "secretario_municipal", label: "Secretário(a) Municipal", labelMasculino: "Secretário Municipal", labelFeminino: "Secretária Municipal", requiresEstado: true, requiresCidade: true, requiresRA: false, locationFieldType: 'bairro' },
  { value: "administrador_regional", label: "Administrador(a) Regional", labelMasculino: "Administrador Regional", labelFeminino: "Administradora Regional", requiresEstado: true, requiresCidade: false, requiresRA: true, locationFieldType: 'ra' },
  { value: "conselheiro_tutelar", label: "Conselheiro(a) Tutelar", labelMasculino: "Conselheiro Tutelar", labelFeminino: "Conselheira Tutelar", requiresEstado: true, requiresCidade: true, requiresRA: false, locationFieldType: 'bairro' },
  { value: "outro", label: "Outro", labelMasculino: "Outro", labelFeminino: "Outra", requiresEstado: true, requiresCidade: false, requiresRA: false, locationFieldType: 'cidade' },
];

// Nomes femininos comuns no Brasil para detecção de gênero pelo primeiro nome
const NOMES_FEMININOS = new Set([
  "maria", "ana", "juliana", "fernanda", "patricia", "camila", "amanda", "bruna",
  "carolina", "daniela", "renata", "vanessa", "tatiana", "leticia", "priscila",
  "adriana", "aline", "bianca", "carla", "claudia", "cristina", "denise", "elaine",
  "fabiana", "gabriela", "helena", "isabela", "jessica", "karen", "larissa", "luciana",
  "mariana", "natalia", "paula", "rafaela", "sandra", "simone", "talita", "viviane",
  "alice", "beatriz", "cecilia", "diana", "eduarda", "flavia", "gloria", "ingrid",
  "joana", "katia", "ligia", "marta", "nadia", "olga", "raquel", "silvia", "tereza",
  "ursula", "valeria", "wanda", "yasmin", "zelia", "rose", "rosa", "lucia", "luana",
  "milena", "monica", "roberta", "soraia", "tania", "vera", "vitoria", "angelica",
  "antonia", "aparecida", "barbara", "celia", "debora", "elisa", "fatima", "gisele",
  "heloisa", "irene", "jaqueline", "kelly", "lilian", "margarete", "neide", "paloma",
  "regina", "sueli", "thais", "valquiria", "rosangela", "sonia", "andrea", "stella",
  "ivone", "marlene", "nilza", "odete", "penelope", "queila", "renilde", "socorro",
  "teresinha", "vania", "zenaide", "luiza", "marina", "sofia", "clara", "laura",
  "lorena", "mirella", "nicole", "pietra", "rebeca", "sarah", "valentina", "yara",
]);

/**
 * Detecta o gênero provável com base no primeiro nome.
 * Retorna 'feminino', 'masculino' ou 'neutro' se não conseguir identificar.
 */
export function detectGenderByName(nome: string | null | undefined): 'masculino' | 'feminino' | 'neutro' {
  if (!nome) return 'neutro';
  const firstName = nome.trim().split(/\s+/)[0].toLowerCase();
  if (NOMES_FEMININOS.has(firstName)) return 'feminino';
  // Heurística: nomes terminados em 'a' são frequentemente femininos no português
  // Exceções comuns: luca, mica, etc. — mas a lista já cobre os mais comuns
  return 'masculino';
}

/**
 * Retorna o label do cargo flexionado pelo gênero do nome.
 * Ex: getCargoLabelGendered("deputado_federal", "Maria Silva") => "Deputada Federal"
 */
export function getCargoLabelGendered(cargoValue: string | null | undefined, nome: string | null | undefined): string {
  if (!cargoValue) return '';
  const cargo = CARGOS_POLITICOS.find(c => c.value === cargoValue);
  if (!cargo) return cargoValue;
  const gender = detectGenderByName(nome);
  if (gender === 'feminino') return cargo.labelFeminino;
  return cargo.labelMasculino;
}

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
