/**
 * Demo Strategic Map Data
 * Fictitious leaders, contacts, and cities for demo-mode users
 */
import type { LeaderMapData, ContactMapData, CityMapData } from "@/hooks/maps/useStrategicMapData";

// Real RA coordinates from database
const RA_COORDS: Record<string, { lat: number; lng: number; nome: string; codigo_ra: string; id: string }> = {
  ceilandia:   { lat: -15.8533, lng: -48.0617, nome: "Ceilândia", codigo_ra: "RA-09", id: "b3419e71-81de-4bb6-9791-beddc72b65e8" },
  taguatinga:  { lat: -15.8369, lng: -48.0517, nome: "Taguatinga", codigo_ra: "RA-03", id: "demo-city-tag" },
  samambaia:   { lat: -15.8667, lng: -48.0333, nome: "Samambaia", codigo_ra: "RA-12", id: "ff6cbc1f-f73b-40e8-8af9-25fb3dc8e00a" },
  aguas_claras:{ lat: -15.87,   lng: -48.105,  nome: "Águas Claras", codigo_ra: "RA-20", id: "3de14a47-a637-43fb-b57f-ad70aea5bea2" },
  plano_piloto:{ lat: -15.7942, lng: -47.8825, nome: "Brasília", codigo_ra: "RA-01", id: "6070d49d-4e46-4ff4-ad21-c2368c5b711f" },
  gama:        { lat: -15.8363, lng: -47.9064, nome: "Gama", codigo_ra: "RA-02", id: "705bee9b-b05f-451e-9e59-b4bcaddbeb01" },
  sobradinho:  { lat: -15.8797, lng: -47.9544, nome: "Sobradinho", codigo_ra: "RA-05", id: "8c6adae7-46d0-420e-a0e0-751ef6b80dbe" },
  planaltina:  { lat: -15.6185, lng: -47.6574, nome: "Planaltina", codigo_ra: "RA-06", id: "97f66002-35e4-4449-80df-7ba353837bf8" },
  recanto:     { lat: -15.8889, lng: -48.0803, nome: "Recanto das Emas", codigo_ra: "RA-15", id: "a6943315-026d-4716-9868-adbf9e9f157a" },
  santa_maria: { lat: -15.8178, lng: -47.8878, nome: "Santa Maria", codigo_ra: "RA-13", id: "b48f4dd6-d390-4ed0-8963-ea415a573a81" },
  guara:       { lat: -15.7744, lng: -47.8919, nome: "Guará", codigo_ra: "RA-10", id: "7c12f8a8-7e05-4253-a36e-cc29b138ddf9" },
  paranoa:     { lat: -15.7825, lng: -47.8992, nome: "Paranoá", codigo_ra: "RA-07", id: "be1803a2-a809-41e9-919a-9bd55e4110e3" },
};

const REGIONS = Object.values(RA_COORDS);

// Seeded random for deterministic generation
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Generate Coordinators (one per major region) ──
const COORDINATOR_REGIONS = ["ceilandia", "taguatinga", "samambaia", "aguas_claras", "plano_piloto", "gama", "sobradinho", "planaltina", "recanto", "santa_maria"];
const COORD_NAMES = [
  "Marcos Vinícius de Almeida",
  "Patrícia Souza Lima",
  "Carlos Eduardo Ferreira",
  "Ana Beatriz Nascimento",
  "Rafael dos Santos Costa",
  "Fernanda Oliveira Rocha",
  "Lucas Pereira Silva",
  "Juliana Martins Dias",
  "Thiago Barbosa Melo",
  "Camila Araújo Ribeiro",
];

function generateDemoLeaders(): LeaderMapData[] {
  const rng = seededRng(42);
  const leaders: LeaderMapData[] = [];

  // Coordinators
  COORDINATOR_REGIONS.forEach((regionKey, i) => {
    const region = RA_COORDS[regionKey];
    leaders.push({
      id: `demo-coord-${i}`,
      nome_completo: COORD_NAMES[i],
      cadastros: Math.floor(40 + rng() * 60),
      pontuacao_total: Math.floor(800 + rng() * 700),
      latitude: region.lat,
      longitude: region.lng,
      cidade_nome: region.nome,
      cidade_id: region.id,
      localidade: null,
      is_coordinator: true,
      hierarchy_level: 0,
      parent_leader_id: null,
      email: `coordenador${i + 1}@email.com`,
      telefone: `619${90 + i}00${1000 + i}`,
    });
  });

  // Sub-leaders (5-8 per coordinator)
  const LEADER_FIRST = ["Bruno", "Larissa", "Diego", "Amanda", "Felipe", "Isabela", "Rodrigo", "Vanessa", "André", "Renata", "Gustavo", "Tatiana", "Henrique", "Bianca", "Leonardo"];
  const LEADER_LAST = ["Silva", "Santos", "Oliveira", "Souza", "Pereira", "Costa", "Ferreira", "Almeida", "Nascimento", "Lima", "Araújo", "Melo", "Barbosa", "Ribeiro", "Martins"];

  let leaderIdx = 0;
  COORDINATOR_REGIONS.forEach((regionKey, coordIdx) => {
    const region = RA_COORDS[regionKey];
    const count = 5 + Math.floor(rng() * 4);
    for (let j = 0; j < count; j++) {
      const first = LEADER_FIRST[(leaderIdx + j) % LEADER_FIRST.length];
      const last = LEADER_LAST[(leaderIdx + j + 3) % LEADER_LAST.length];
      leaders.push({
        id: `demo-leader-${leaderIdx}`,
        nome_completo: `${first} ${last}`,
        cadastros: Math.floor(5 + rng() * 30),
        pontuacao_total: Math.floor(100 + rng() * 500),
        latitude: region.lat,
        longitude: region.lng,
        cidade_nome: region.nome,
        localidade: null,
        is_coordinator: false,
        hierarchy_level: 1,
        parent_leader_id: `demo-coord-${coordIdx}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@email.com`,
        telefone: `619${80 + leaderIdx}00${2000 + leaderIdx}`,
      });
      leaderIdx++;
    }
  });

  return leaders;
}

function generateDemoContacts(leaders: LeaderMapData[]): ContactMapData[] {
  const rng = seededRng(99);
  const contacts: ContactMapData[] = [];
  const FIRST_NAMES = ["Maria", "João", "Ana", "Pedro", "Luísa", "Paulo", "Carla", "José", "Sandra", "Antônio", "Cláudia", "Ricardo", "Tereza", "Fábio", "Sônia"];
  const LAST_NAMES = ["Gomes", "Monteiro", "Dias", "Rocha", "Carvalho", "Freitas", "Nunes", "Moreira", "Teixeira", "Vieira"];

  // Distribute contacts across regions, some linked to leaders
  let contactIdx = 0;
  REGIONS.forEach((region) => {
    const count = 30 + Math.floor(rng() * 50);
    const regionLeaders = leaders.filter(l => l.cidade_nome === region.nome && !l.is_coordinator);

    for (let j = 0; j < count; j++) {
      const first = FIRST_NAMES[contactIdx % FIRST_NAMES.length];
      const last = LAST_NAMES[(contactIdx + 5) % LAST_NAMES.length];
      const linkedLeader = regionLeaders.length > 0 && rng() > 0.4
        ? regionLeaders[Math.floor(rng() * regionLeaders.length)]
        : null;

      contacts.push({
        id: `demo-contact-${contactIdx}`,
        nome: `${first} ${last}`,
        source_type: linkedLeader ? "lider" : (rng() > 0.5 ? "evento" : "formulario"),
        source_id: linkedLeader?.id || null,
        latitude: region.lat,
        longitude: region.lng,
        cidade_nome: region.nome,
        localidade: null,
      });
      contactIdx++;
    }
  });

  return contacts;
}

function generateDemoCities(leaders: LeaderMapData[], contacts: ContactMapData[]): CityMapData[] {
  return REGIONS.map((region) => {
    const leadersCount = leaders.filter(l => l.cidade_nome === region.nome).length;
    const contactsCount = contacts.filter(c => c.cidade_nome === region.nome).length;
    return {
      id: region.id,
      nome: region.nome,
      codigo_ra: region.codigo_ra,
      latitude: region.lat,
      longitude: region.lng,
      leaders_count: leadersCount,
      contacts_count: contactsCount,
    };
  });
}

// Pre-generate all data (deterministic)
export const DEMO_MAP_LEADERS = generateDemoLeaders();
export const DEMO_MAP_CONTACTS = generateDemoContacts(DEMO_MAP_LEADERS);
export const DEMO_MAP_CITIES = generateDemoCities(DEMO_MAP_LEADERS, DEMO_MAP_CONTACTS);

export const DEMO_MAP_STATS = {
  coordinatorsCount: DEMO_MAP_LEADERS.filter(l => l.is_coordinator).length,
  leadersCount: DEMO_MAP_LEADERS.filter(l => !l.is_coordinator).length,
  contactsCount: DEMO_MAP_CONTACTS.length,
};
