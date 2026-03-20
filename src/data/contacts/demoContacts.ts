/**
 * Fake contacts data for demo mode.
 * These contacts are generated deterministically and only shown
 * when the logged-in user has is_demo=true.
 */

const FIRST_NAMES_F = [
  "Ana", "Maria", "Paula", "Luísa", "Fernanda", "Beatriz", "Juliana",
  "Camila", "Larissa", "Amanda", "Isabela", "Patrícia", "Vanessa",
  "Renata", "Tatiana", "Mariana", "Gabriela", "Letícia", "Bruna", "Daniela",
];

const FIRST_NAMES_M = [
  "Carlos", "João", "Pedro", "Rafael", "Lucas", "Gabriel", "Thiago",
  "Bruno", "Diego", "Felipe", "Rodrigo", "Gustavo", "André", "Marcos",
  "Henrique", "Leonardo", "Eduardo", "Matheus", "Vinícius", "Ricardo",
];

const LAST_NAMES = [
  "Silva", "Santos", "Oliveira", "Souza", "Pereira", "Costa", "Ferreira",
  "Almeida", "Nascimento", "Lima", "Araújo", "Melo", "Barbosa", "Ribeiro",
  "Martins", "Rocha", "Carvalho", "Gomes", "Monteiro", "Dias",
  "Teixeira", "Moreira", "Nunes", "Cunha", "Lopes",
];

const CITIES = [
  { id: "demo-city-01", nome: "Águas Claras", codigo_ra: "RA-XX" },
  { id: "demo-city-02", nome: "Taguatinga", codigo_ra: "RA-III" },
  { id: "demo-city-03", nome: "Ceilândia", codigo_ra: "RA-IX" },
  { id: "demo-city-04", nome: "Samambaia", codigo_ra: "RA-XII" },
  { id: "demo-city-05", nome: "Plano Piloto", codigo_ra: "RA-I" },
  { id: "demo-city-06", nome: "Gama", codigo_ra: "RA-II" },
  { id: "demo-city-07", nome: "Sobradinho", codigo_ra: "RA-V" },
  { id: "demo-city-08", nome: "Planaltina", codigo_ra: "RA-VI" },
  { id: "demo-city-09", nome: "Recanto das Emas", codigo_ra: "RA-XV" },
  { id: "demo-city-10", nome: "Santa Maria", codigo_ra: "RA-XIII" },
  { id: "demo-city-11", nome: "São Sebastião", codigo_ra: "RA-XIV" },
  { id: "demo-city-12", nome: "Vicente Pires", codigo_ra: "RA-XXX" },
];

const SOURCE_TYPES = ["evento", "lider", "captacao", "manual", "visita", "webhook", "pesquisa"];

const EVENT_NAMES = [
  "Reunião Comunitária Zona Norte",
  "Audiência Pública Saúde",
  "Workshop Empreendedorismo",
  "Encontro de Líderes Regionais",
  "Palestra Educação Digital",
  "Seminário Meio Ambiente",
];

const LEADER_NAMES = [
  "Maria Aparecida dos Santos",
  "José Carlos Oliveira",
  "Francisca Lima",
  "Antônio Pereira",
  "Luciana Costa",
  "Roberto Almeida",
];

const FUNNEL_NAMES = [
  "eBook Direitos do Cidadão",
  "Guia Serviços Públicos DF",
  "Manual do Empreendedor",
];

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generatePhone(seed: number): string {
  const ddd = "61";
  const prefix = "9";
  const digits = Array.from({ length: 8 }, (_, i) =>
    Math.floor(seededRandom(seed * 100 + i) * 10)
  ).join("");
  return `(${ddd}) ${prefix}${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function generatePhoneNorm(seed: number): string {
  const digits = Array.from({ length: 8 }, (_, i) =>
    Math.floor(seededRandom(seed * 100 + i) * 10)
  ).join("");
  return `+55619${digits}`;
}

function generateEmail(firstName: string, lastName: string, seed: number): string {
  const providers = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br"];
  const provider = providers[Math.floor(seededRandom(seed) * providers.length)];
  const name = `${firstName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}.${lastName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`;
  return `${name}@${provider}`;
}

function generateDate(seed: number, daysAgo: number): string {
  const now = new Date();
  const offset = Math.floor(seededRandom(seed) * daysAgo);
  const date = new Date(now.getTime() - offset * 86400000);
  return date.toISOString();
}

export interface DemoContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  region: string;
  registrationDate: string;
  source: string;
  sourceName: string | null;
  sourceType: string;
  consentWhatsApp: boolean;
  consentEmail: boolean;
  lastActivity: string;
  cidade_id: string;
  telefone_norm: string;
  source_type: string;
  source_id: string | null;
  genero: string;
  data_nascimento: string | null;
  is_verified: boolean;
  verification_code: string | null;
  verification_sent_at: string | null;
  verified_at: string | null;
  requiresVerification: boolean;
  is_active: boolean;
  opted_out_at: string | null;
  opt_out_reason: string | null;
  opt_out_channel: string | null;
  is_promoted: boolean;
}

export function generateDemoContacts(count: number = 127): DemoContact[] {
  const contacts: DemoContact[] = [];

  for (let i = 0; i < count; i++) {
    const seed = i + 42;
    const isFemale = seededRandom(seed * 7) > 0.45;
    const firstNames = isFemale ? FIRST_NAMES_F : FIRST_NAMES_M;
    const firstName = firstNames[Math.floor(seededRandom(seed * 3) * firstNames.length)];
    const lastName1 = LAST_NAMES[Math.floor(seededRandom(seed * 5) * LAST_NAMES.length)];
    const lastName2 = LAST_NAMES[Math.floor(seededRandom(seed * 11) * LAST_NAMES.length)];
    const fullName = `${firstName} ${lastName1} ${lastName2}`;

    const city = CITIES[Math.floor(seededRandom(seed * 13) * CITIES.length)];
    const sourceType = SOURCE_TYPES[Math.floor(seededRandom(seed * 17) * SOURCE_TYPES.length)];

    let sourceName: string | null = null;
    let sourceInfo = "Importação";
    const requiresVerification = sourceType === "lider";

    if (sourceType === "evento") {
      sourceName = EVENT_NAMES[Math.floor(seededRandom(seed * 19) * EVENT_NAMES.length)];
      sourceInfo = `Evento: ${sourceName}`;
    } else if (sourceType === "lider") {
      sourceName = LEADER_NAMES[Math.floor(seededRandom(seed * 23) * LEADER_NAMES.length)];
      sourceInfo = `Líder: ${sourceName}`;
    } else if (sourceType === "captacao") {
      sourceName = FUNNEL_NAMES[Math.floor(seededRandom(seed * 29) * FUNNEL_NAMES.length)];
      sourceInfo = `Captação: ${sourceName}`;
    } else if (sourceType === "visita") {
      sourceName = `GAB-2025-${String(Math.floor(seededRandom(seed * 31) * 9000) + 1000).padStart(4, "0")}`;
      sourceInfo = `Visita: ${sourceName}`;
    } else if (sourceType === "webhook") {
      sourceName = "GreatPages";
      sourceInfo = "Webhook: GreatPages";
    } else if (sourceType === "pesquisa") {
      sourceName = "Pesquisa de Satisfação";
      sourceInfo = `Pesquisa: ${sourceName}`;
    }

    const hasEmail = seededRandom(seed * 37) > 0.3;
    const email = hasEmail ? generateEmail(firstName, lastName1, seed) : "";

    const isVerified = requiresVerification ? seededRandom(seed * 41) > 0.4 : false;
    const verificationSentAt = requiresVerification ? generateDate(seed * 43, 60) : null;

    const isActive = seededRandom(seed * 47) > 0.08; // 92% active
    const isPromoted = seededRandom(seed * 53) > 0.95; // 5% promoted

    const hasBirthDate = seededRandom(seed * 59) > 0.5;
    const birthYear = 1960 + Math.floor(seededRandom(seed * 61) * 45);
    const birthMonth = 1 + Math.floor(seededRandom(seed * 67) * 12);
    const birthDay = 1 + Math.floor(seededRandom(seed * 71) * 28);

    contacts.push({
      id: `demo-contact-${String(i).padStart(4, "0")}`,
      name: fullName,
      phone: generatePhone(seed),
      email,
      region: city.nome,
      registrationDate: generateDate(seed * 73, 365),
      source: sourceInfo,
      sourceName,
      sourceType,
      consentWhatsApp: true,
      consentEmail: hasEmail,
      lastActivity: generateDate(seed * 79, 30),
      cidade_id: city.id,
      telefone_norm: generatePhoneNorm(seed),
      source_type: sourceType,
      source_id: sourceType !== "manual" ? `demo-source-${i}` : null,
      genero: isFemale ? "Feminino" : "Masculino",
      data_nascimento: hasBirthDate
        ? `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`
        : null,
      is_verified: isVerified,
      verification_code: requiresVerification ? String(Math.floor(seededRandom(seed * 83) * 900000) + 100000) : null,
      verification_sent_at: verificationSentAt,
      verified_at: isVerified ? generateDate(seed * 89, 30) : null,
      requiresVerification,
      is_active: isActive,
      opted_out_at: !isActive ? generateDate(seed * 97, 60) : null,
      opt_out_reason: !isActive ? "Solicitou remoção" : null,
      opt_out_channel: !isActive ? (seededRandom(seed * 101) > 0.5 ? "whatsapp" : "email") : null,
      is_promoted: isPromoted,
    });
  }

  return contacts;
}

// Pre-generated for consistent rendering
export const DEMO_CONTACTS = generateDemoContacts();

// Stats
export const DEMO_CONTACTS_STATS = {
  total: DEMO_CONTACTS.length,
  withWhatsApp: DEMO_CONTACTS.filter((c) => c.phone).length,
  withEmail: DEMO_CONTACTS.filter((c) => c.email).length,
};
