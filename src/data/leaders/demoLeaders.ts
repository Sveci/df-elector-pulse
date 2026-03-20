/**
 * Fake leaders data for demo mode.
 * Generated deterministically so the same data appears on every render.
 */
import type { OfficeLeader } from "@/types/office";

const FIRST_NAMES_F = [
  "Ana", "Maria", "Paula", "Luísa", "Fernanda", "Beatriz", "Juliana",
  "Camila", "Larissa", "Amanda", "Isabela", "Patrícia", "Vanessa",
  "Renata", "Tatiana", "Mariana", "Gabriela", "Letícia", "Bruna", "Daniela",
];

const FIRST_NAMES_M = [
  "Carlos", "João", "Pedro", "José", "Lucas", "Gabriel", "Thiago",
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
  { id: "demo-city-01", nome: "Águas Claras", codigo_ra: "RA-XX", status: "active" as const, tipo: "DF" as const, created_at: "", updated_at: "" },
  { id: "demo-city-02", nome: "Taguatinga", codigo_ra: "RA-III", status: "active" as const, tipo: "DF" as const, created_at: "", updated_at: "" },
  { id: "demo-city-03", nome: "Ceilândia", codigo_ra: "RA-IX", status: "active" as const, tipo: "DF" as const, created_at: "", updated_at: "" },
  { id: "demo-city-04", nome: "Samambaia", codigo_ra: "RA-XII", status: "active" as const, tipo: "DF" as const, created_at: "", updated_at: "" },
  { id: "demo-city-05", nome: "Plano Piloto", codigo_ra: "RA-I", status: "active" as const, tipo: "DF" as const, created_at: "", updated_at: "" },
  { id: "demo-city-06", nome: "Gama", codigo_ra: "RA-II", status: "active" as const, tipo: "DF" as const, created_at: "", updated_at: "" },
  { id: "demo-city-07", nome: "Sobradinho", codigo_ra: "RA-V", status: "active" as const, tipo: "DF" as const, created_at: "", updated_at: "" },
  { id: "demo-city-08", nome: "Planaltina", codigo_ra: "RA-VI", status: "active" as const, tipo: "DF" as const, created_at: "", updated_at: "" },
  { id: "demo-city-09", nome: "Recanto das Emas", codigo_ra: "RA-XV", status: "active" as const, tipo: "DF" as const, created_at: "", updated_at: "" },
  { id: "demo-city-10", nome: "Santa Maria", codigo_ra: "RA-XIII", status: "active" as const, tipo: "DF" as const, created_at: "", updated_at: "" },
];

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generatePhone(seed: number): string {
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

function generateBirthDate(seed: number): string {
  const year = 1960 + Math.floor(seededRandom(seed * 61) * 45);
  const month = 1 + Math.floor(seededRandom(seed * 67) * 12);
  const day = 1 + Math.floor(seededRandom(seed * 71) * 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDaysUntilBirthday(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  const nextBirthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (nextBirthday < today) {
    nextBirthday.setFullYear(today.getFullYear() + 1);
  }
  return Math.ceil((nextBirthday.getTime() - today.getTime()) / 86400000);
}

export function generateDemoLeaders(count: number = 85): OfficeLeader[] {
  const leaders: OfficeLeader[] = [];

  // Generate coordinators first (10-12)
  const coordinatorCount = 10;

  for (let i = 0; i < count; i++) {
    const seed = i + 137; // different seed base from contacts
    const isFemale = seededRandom(seed * 7) > 0.45;
    const firstNames = isFemale ? FIRST_NAMES_F : FIRST_NAMES_M;
    const firstName = firstNames[Math.floor(seededRandom(seed * 3) * firstNames.length)];
    const lastName1 = LAST_NAMES[Math.floor(seededRandom(seed * 5) * LAST_NAMES.length)];
    const lastName2 = LAST_NAMES[Math.floor(seededRandom(seed * 11) * LAST_NAMES.length)];
    const fullName = `${firstName} ${lastName1} ${lastName2}`;

    const city = CITIES[Math.floor(seededRandom(seed * 13) * CITIES.length)];

    const isCoordinator = i < coordinatorCount;
    const hierarchyLevel = isCoordinator ? 1 : 2 + Math.floor(seededRandom(seed * 19) * 4); // 2-5
    const parentLeaderId = isCoordinator ? undefined : `demo-leader-${String(Math.floor(seededRandom(seed * 23) * coordinatorCount)).padStart(4, "0")}`;

    const pontos = isCoordinator
      ? 200 + Math.floor(seededRandom(seed * 29) * 800)
      : 10 + Math.floor(seededRandom(seed * 31) * 400);
    const cadastros = isCoordinator
      ? 20 + Math.floor(seededRandom(seed * 37) * 80)
      : Math.floor(seededRandom(seed * 41) * 30);

    const isActive = seededRandom(seed * 43) > 0.05;
    const isVerified = seededRandom(seed * 47) > 0.2;

    const hasBirth = seededRandom(seed * 53) > 0.3;
    const birthDate = hasBirth ? generateBirthDate(seed) : undefined;

    const hasEmail = seededRandom(seed * 59) > 0.25;
    const hasPasskit = isVerified && seededRandom(seed * 61) > 0.5;

    leaders.push({
      id: `demo-leader-${String(i).padStart(4, "0")}`,
      nome_completo: fullName,
      email: hasEmail ? generateEmail(firstName, lastName1, seed) : undefined,
      telefone: generatePhone(seed),
      cidade_id: city.id,
      cidade: city,
      status: isActive ? "active" : "inactive",
      pontuacao_total: pontos,
      cadastros,
      is_active: isActive,
      affiliate_token: `demo-token-${String(i).padStart(4, "0")}`,
      last_activity: generateDate(seed * 67, 30),
      join_date: generateDate(seed * 71, 365),
      data_nascimento: birthDate,
      is_coordinator: isCoordinator,
      hierarchy_level: hierarchyLevel,
      parent_leader_id: parentLeaderId,
      is_verified: isVerified,
      verification_code: !isVerified ? `VER${String(Math.floor(seededRandom(seed * 73) * 9000) + 1000)}` : undefined,
      verification_sent_at: !isVerified ? generateDate(seed * 79, 60) : undefined,
      verified_at: isVerified ? generateDate(seed * 83, 90) : undefined,
      verification_method: isVerified ? "link" : undefined,
      passkit_member_id: hasPasskit ? `pk-${i}` : undefined,
      passkit_pass_installed: hasPasskit ? seededRandom(seed * 89) > 0.3 : false,
      days_until_birthday: birthDate ? getDaysUntilBirthday(birthDate) : undefined,
      created_at: generateDate(seed * 97, 365),
      updated_at: generateDate(seed * 101, 30),
    });
  }

  return leaders;
}

export const DEMO_LEADERS = generateDemoLeaders();

export const DEMO_LEADERS_STATS = {
  total: DEMO_LEADERS.length,
  active: DEMO_LEADERS.filter((l) => l.is_active).length,
  verified: DEMO_LEADERS.filter((l) => l.is_verified).length,
  totalPoints: DEMO_LEADERS.reduce((sum, l) => sum + l.pontuacao_total, 0),
};

/**
 * Simulates backend pagination and filtering for demo leaders.
 */
export function getDemoLeadersPaginated(options: {
  page?: number;
  pageSize?: number;
  search?: string;
  cidade_id?: string;
  sortBy?: string;
  verificationFilter?: string;
  statusFilter?: string;
}): { data: OfficeLeader[]; count: number } {
  const { page = 1, pageSize = 10, search, cidade_id, sortBy = "cadastros_desc", verificationFilter = "all", statusFilter = "all" } = options;

  let filtered = [...DEMO_LEADERS];

  // Status filter
  if (statusFilter === "active") {
    filtered = filtered.filter((l) => l.is_active);
  } else if (statusFilter === "inactive") {
    filtered = filtered.filter((l) => !l.is_active);
  }

  // Verification filter
  if (verificationFilter === "verified") {
    filtered = filtered.filter((l) => l.is_verified);
  } else if (verificationFilter === "not_verified") {
    filtered = filtered.filter((l) => !l.is_verified);
  }

  // City filter
  if (cidade_id) {
    filtered = filtered.filter((l) => l.cidade_id === cidade_id);
  }

  // Search
  if (search) {
    const term = search.toLowerCase();
    filtered = filtered.filter(
      (l) =>
        l.nome_completo.toLowerCase().includes(term) ||
        l.telefone?.includes(term) ||
        l.email?.toLowerCase().includes(term)
    );
  }

  // Sort
  switch (sortBy) {
    case "cadastros_desc":
      filtered.sort((a, b) => b.cadastros - a.cadastros);
      break;
    case "cadastros_asc":
      filtered.sort((a, b) => a.cadastros - b.cadastros);
      break;
    case "pontos_desc":
      filtered.sort((a, b) => b.pontuacao_total - a.pontuacao_total);
      break;
    case "pontos_asc":
      filtered.sort((a, b) => a.pontuacao_total - b.pontuacao_total);
      break;
    case "nome_asc":
      filtered.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
      break;
    case "aniversario_proximo":
      filtered.sort((a, b) => (a.days_until_birthday ?? 999) - (b.days_until_birthday ?? 999));
      break;
  }

  const count = filtered.length;
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);

  return { data, count };
}
