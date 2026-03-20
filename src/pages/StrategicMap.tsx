import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Polyline, Marker, useMap } from "react-leaflet";
import { useDemoMask } from "@/contexts/DemoModeContext";
import L from "leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Map as MapIcon, Users, UserCheck, Flame, MapPin, Link2, Navigation,
  Crown, Star, X, Maximize2, Minimize2, Phone, Mail, Trophy, Search,
  BarChart3, ChevronRight,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStrategicMapData, LeaderMapData, ContactMapData } from "@/hooks/maps/useStrategicMapData";
import { DEMO_MAP_LEADERS, DEMO_MAP_CONTACTS, DEMO_MAP_CITIES, DEMO_MAP_STATS } from "@/data/maps/demoMapData";
import { MapController } from "@/components/maps/MapController";
import { MapAnalysisPanel } from "@/components/maps/MapAnalysisPanel";
import { RegionBoundaryLayer } from "@/components/maps/RegionBoundaryLayer";
import { getRACenter, getRAZoomLevel } from "@/data/maps/df-ra-boundaries";
import { useMapTenantConfig } from "@/hooks/maps/useMapTenantConfig";
import "leaflet/dist/leaflet.css";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const mapTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="map-header"]',
    title: "Mapa Estratégico",
    content: "Visualize a distribuição geográfica de líderes e contatos na sua área de atuação.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="map-stats"]',
    title: "Estatísticas",
    content: "Veja o total de coordenadores, líderes, contatos e conexões mapeadas. Os números refletem o filtro ativo.",
    placement: "bottom",
  },
  {
    target: '[data-tutorial="map-controls"]',
    title: "Controles do Mapa",
    content: "Ative/desative camadas como heatmap, líderes e contatos. Filtre por região ou por líder específico.",
    placement: "bottom",
  },
  {
    target: '[data-tutorial="map-container"]',
    title: "Mapa Interativo",
    content: "Clique nos pins de líderes para abrir o painel lateral com detalhes. Use o botão de tela cheia para expandir.",
    placement: "top",
  },
];

// Fallback constants
const CITY_ZOOM = 13;

// Map tile styles
const MAP_STYLES = {
  standard: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    className: "",
  },
  clean: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    className: "",
  },
  grayscale: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    className: "grayscale",
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    className: "",
  },
};

type MapStyleKey = keyof typeof MAP_STYLES;

// Generate unique color for each leader based on ID
function getLeaderColor(leaderId: string): string {
  const hash = leaderId.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

// Golden angle spiral algorithm for spreading pins within a region
function calculateSpreadPosition(
  baseLat: number,
  baseLng: number,
  index: number,
  type: 'coordinator' | 'leader' | 'contact'
): { lat: number; lng: number } {
  const baseRadius = type === 'coordinator' ? 0.004 : type === 'leader' ? 0.008 : 0.012;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const angle = index * goldenAngle;
  const radius = baseRadius * Math.sqrt(index + 1) * 0.4;
  return {
    lat: baseLat + radius * Math.cos(angle),
    lng: baseLng + radius * Math.sin(angle),
  };
}

// Group items by city and calculate spread positions
function getPositionsByCity<T extends { id: string; latitude: number; longitude: number }>(
  items: T[],
  type: 'coordinator' | 'leader' | 'contact'
): Map<string, { lat: number; lng: number }> {
  const positions = new Map<string, { lat: number; lng: number }>();
  const byCityKey = new Map<string, T[]>();
  items.forEach((item) => {
    if (item.latitude == null || item.longitude == null) return;
    const key = `${item.latitude.toFixed(2)},${item.longitude.toFixed(2)}`;
    if (!byCityKey.has(key)) byCityKey.set(key, []);
    byCityKey.get(key)!.push(item);
  });
  byCityKey.forEach((group) => {
    group.forEach((item, indexInGroup) => {
      const pos = calculateSpreadPosition(item.latitude, item.longitude, indexInGroup, type);
      positions.set(item.id, pos);
    });
  });
  return positions;
}

// Create custom star icon for leaders
function createStarIcon(color: string, highlighted = false) {
  const size = highlighted ? 34 : 28;
  const stroke = highlighted ? 3 : 1.5;
  return L.divIcon({
    className: 'custom-star-icon',
    html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}" stroke="white" stroke-width="${stroke}">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Create custom crown icon for coordinators
function createCrownIcon(color: string, highlighted = false) {
  const size = highlighted ? 40 : 32;
  const stroke = highlighted ? 3 : 1.5;
  return L.divIcon({
    className: 'custom-crown-icon',
    html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}" stroke="white" stroke-width="${stroke}">
      <path d="M2 17l2-6 4 3 4-8 4 8 4-3 2 6H2z"/>
      <rect x="3" y="18" width="18" height="3" rx="1"/>
    </svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Heatmap component
function HeatmapLayer({ contacts, enabled }: { contacts: ContactMapData[]; enabled: boolean }) {
  const heatData = useMemo(() => {
    if (!enabled || contacts.length === 0) return [];
    const grouped = contacts.reduce((acc: Record<string, { lat: number; lng: number; count: number }>, c) => {
      if (c.latitude == null || c.longitude == null) return acc;
      const key = `${c.latitude.toFixed(2)},${c.longitude.toFixed(2)}`;
      if (!acc[key]) acc[key] = { lat: c.latitude, lng: c.longitude, count: 0 };
      acc[key].count++;
      return acc;
    }, {});
    return Object.values(grouped);
  }, [contacts, enabled]);

  if (!enabled || heatData.length === 0) return null;

  return (
    <>
      {heatData.map((point, i) => (
        <Circle
          key={`heat-${i}`}
          center={[point.lat, point.lng]}
          radius={Math.min(point.count * 200, 3000)}
          pathOptions={{
            color: "transparent",
            fillColor: point.count > 50 ? "#ef4444" : point.count > 20 ? "#f97316" : "#eab308",
            fillOpacity: Math.min(0.1 + point.count * 0.005, 0.4),
          }}
        />
      ))}
    </>
  );
}

// Hierarchy connections layer - draws lines from coordinators to their subordinate leaders
function HierarchyConnectionsLayer({
  leaders,
  leaderPositions,
  enabled,
}: {
  leaders: LeaderMapData[];
  leaderPositions: Map<string, { lat: number; lng: number }>;
  enabled: boolean;
}) {
  // P4 fix: O(1) lookup map
  const leaderById = useMemo(() => {
    const m = new Map<string, LeaderMapData>();
    leaders.forEach(l => m.set(l.id, l));
    return m;
  }, [leaders]);

  const connections = useMemo(() => {
    if (!enabled) return [];
    const lines: Array<{
      from: [number, number];
      to: [number, number];
      color: string;
      coordinatorName: string;
      leaderName: string;
    }> = [];
    leaders.forEach((leader) => {
      if (leader.parent_leader_id) {
        const coordinatorPos = leaderPositions.get(leader.parent_leader_id);
        const leaderPos = leaderPositions.get(leader.id);
        if (coordinatorPos && leaderPos) {
          const coordinator = leaderById.get(leader.parent_leader_id);
          lines.push({
            from: [coordinatorPos.lat, coordinatorPos.lng],
            to: [leaderPos.lat, leaderPos.lng],
            color: getLeaderColor(leader.parent_leader_id),
            coordinatorName: coordinator?.nome_completo || "",
            leaderName: leader.nome_completo,
          });
        }
      }
    });
    return lines;
  }, [leaders, leaderPositions, enabled, leaderById]);

  if (!enabled || connections.length === 0) return null;

  return (
    <>
      {connections.map((conn, i) => (
        <Polyline
          key={`hierarchy-${i}`}
          positions={[conn.from, conn.to]}
          pathOptions={{ color: conn.color, weight: 2.5, opacity: 0.8, dashArray: "10, 6" }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">👑 {conn.coordinatorName}</p>
              <p className="text-muted-foreground">→ ⭐ {conn.leaderName}</p>
            </div>
          </Popup>
        </Polyline>
      ))}
    </>
  );
}

// Leader-to-Contact connections layer
function ConnectionsLayer({
  leaders,
  contacts,
  leaderPositions,
  contactPositions,
  enabled,
}: {
  leaders: LeaderMapData[];
  contacts: ContactMapData[];
  leaderPositions: Map<string, { lat: number; lng: number }>;
  contactPositions: Map<string, { lat: number; lng: number }>;
  enabled: boolean;
}) {
  // P4 fix: O(1) lookup map
  const leaderById = useMemo(() => {
    const m = new Map<string, LeaderMapData>();
    leaders.forEach(l => m.set(l.id, l));
    return m;
  }, [leaders]);

  const connections = useMemo(() => {
    if (!enabled) return [];
    const lines: Array<{
      from: [number, number];
      to: [number, number];
      color: string;
      leaderName: string;
      contactName: string;
    }> = [];
    contacts.forEach((contact) => {
      if (contact.source_type === "lider" && contact.source_id) {
        const leaderPos = leaderPositions.get(contact.source_id);
        const contactPos = contactPositions.get(contact.id);
        if (leaderPos && contactPos) {
          lines.push({
            from: [leaderPos.lat, leaderPos.lng],
            to: [contactPos.lat, contactPos.lng],
            color: getLeaderColor(contact.source_id),
            leaderName: leaderById.get(contact.source_id)?.nome_completo || "",
            contactName: contact.nome,
          });
        }
      }
    });
    return lines;
  }, [leaders, contacts, leaderPositions, contactPositions, enabled, leaderById]);

  if (!enabled || connections.length === 0) return null;

  return (
    <>
      {connections.map((conn, i) => (
        <Polyline
          key={`connection-${i}`}
          positions={[conn.from, conn.to]}
          pathOptions={{ color: conn.color, weight: 1.5, opacity: 0.5, dashArray: "4, 4" }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{conn.leaderName}</p>
              <p className="text-muted-foreground">→ {conn.contactName}</p>
            </div>
          </Popup>
        </Polyline>
      ))}
    </>
  );
}

// ─────────────────────────────────────────────
// Leader Detail Side Panel
// ─────────────────────────────────────────────
interface LeaderDetailPanelProps {
  leader: LeaderMapData | null;
  allLeaders: LeaderMapData[];
  contactsForLeader: ContactMapData[];
  onClose: () => void;
  isDemoMode: boolean;
  m: ReturnType<typeof useDemoMask>["m"];
}

function LeaderDetailPanel({ leader, allLeaders, contactsForLeader, onClose, isDemoMode, m }: LeaderDetailPanelProps) {
  if (!leader) return null;

  const color = getLeaderColor(leader.id);
  const parentLeader = leader.parent_leader_id
    ? allLeaders.find(l => l.id === leader.parent_leader_id)
    : null;
  const subordinates = allLeaders.filter(l => l.parent_leader_id === leader.id);

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-background border-l shadow-xl z-[1000] flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b" style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white text-lg font-bold"
            style={{ backgroundColor: color }}>
            {leader.is_coordinator ? "👑" : "⭐"}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">
              {m.name(leader.nome_completo)}
            </p>
            <p className="text-xs text-muted-foreground">
              {leader.is_coordinator ? "Coordenador" : "Líder"}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{m.number(leader.cadastros, leader.id + "_cad")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Cadastros</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{m.number(leader.pontuacao_total, leader.id + "_pts")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pontos</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{contactsForLeader.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Contatos vinc.</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{subordinates.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Subordinados</p>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Localização</p>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{m.city(leader.localidade || leader.cidade_nome)}</span>
            </div>
          </div>

          {/* Contact info */}
          {(leader.email || leader.telefone) && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contato</p>
              {leader.telefone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{m.phone(leader.telefone)}</span>
                </div>
              )}
              {leader.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{m.email(leader.email)}</span>
                </div>
              )}
            </div>
          )}

          {/* Hierarchy */}
          {parentLeader && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reporta a</p>
              <div className="flex items-center gap-2 p-2 rounded-lg border">
                <span>👑</span>
                <span className="text-sm font-medium truncate">{m.name(parentLeader.nome_completo)}</span>
              </div>
            </div>
          )}

          {subordinates.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Líderes subordinados ({subordinates.length})
              </p>
              <div className="space-y-1">
                {subordinates.slice(0, 5).map(sub => (
                  <div key={sub.id} className="flex items-center gap-2 p-2 rounded-lg border text-sm">
                    <span>⭐</span>
                    <span className="truncate">{m.name(sub.nome_completo)}</span>
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">{sub.cadastros} cad.</span>
                  </div>
                ))}
                {subordinates.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">+{subordinates.length - 5} mais</p>
                )}
              </div>
            </div>
          )}

          {/* Top contacts */}
          {contactsForLeader.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Últimos contatos vinculados ({contactsForLeader.length})
              </p>
              <div className="space-y-1">
                {contactsForLeader.slice(0, 5).map(c => (
                  <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">{m.name(c.nome)}</span>
                    <span className="ml-auto text-xs text-muted-foreground shrink-0 truncate">{m.city(c.localidade || c.cidade_nome)}</span>
                  </div>
                ))}
                {contactsForLeader.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">+{contactsForLeader.length - 5} mais</p>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─────────────────────────────────────────────
// Region Stats mini-card (N2)
// ─────────────────────────────────────────────
function RegionStatsCard({
  regionName,
  leaders,
  contacts,
  isDemoMode,
  m,
}: {
  regionName: string;
  leaders: LeaderMapData[];
  contacts: ContactMapData[];
  isDemoMode: boolean;
  m: ReturnType<typeof useDemoMask>["m"];
}) {
  const topLeaders = useMemo(() =>
    [...leaders].sort((a, b) => b.pontuacao_total - a.pontuacao_total).slice(0, 3),
    [leaders]
  );

  if (leaders.length === 0 && contacts.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          {regionName}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        <div className="flex gap-4 text-sm">
          <span><strong>{leaders.length}</strong> <span className="text-muted-foreground">líderes</span></span>
          <span><strong>{contacts.length}</strong> <span className="text-muted-foreground">contatos</span></span>
        </div>
        {topLeaders.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Top líderes</p>
            {topLeaders.map((l, i) => (
              <div key={l.id} className="flex items-center gap-2 text-xs">
                <Trophy className={`h-3 w-3 shrink-0 ${i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : "text-amber-700"}`} />
                <span className="truncate">{m.name(l.nome_completo)}</span>
                <span className="ml-auto shrink-0 text-muted-foreground">{m.number(l.pontuacao_total, l.id + "_rk")} pts</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function StrategicMap() {
  const { isDemoMode, m } = useDemoMask();
  const mapTenantConfig = useMapTenantConfig();
  const { leaders: dbLeaders, contacts: dbContacts, cities: dbCities, stats: dbStats, isLoading, error } = useStrategicMapData();

  // Demo mode overrides
  const leaders = isDemoMode ? DEMO_MAP_LEADERS : dbLeaders;
  const contacts = isDemoMode ? DEMO_MAP_CONTACTS : dbContacts;
  const cities = isDemoMode ? DEMO_MAP_CITIES : dbCities;
  const stats = isDemoMode ? DEMO_MAP_STATS : dbStats;

  // Layer toggles
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showLeaders, setShowLeaders] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [showConnections, setShowConnections] = useState(false);

  // Style & filters
  const [mapStyle, setMapStyle] = useState<MapStyleKey>("clean");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [selectedLeader, setSelectedLeader] = useState<string>("all");
  const [leaderSearch, setLeaderSearch] = useState("");

  // UI state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedLeaderDetail, setSelectedLeaderDetail] = useState<LeaderMapData | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const { restartTutorial } = useTutorial("strategic-map", mapTutorialSteps);

  // ── Leader dropdown options with search ──
  const leaderOptions = useMemo(() => {
    const q = leaderSearch.toLowerCase();
    const filtered = q
      ? leaders.filter(l => l.nome_completo.toLowerCase().includes(q))
      : leaders;
    const coordinators = filtered.filter(l => l.is_coordinator).sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
    const regularLeaders = filtered.filter(l => !l.is_coordinator).sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
    return { coordinators, regularLeaders };
  }, [leaders, leaderSearch]);

  // ── B1+B2: Filter visible leaders by BOTH region AND leader selection ──
  const visibleLeaders = useMemo(() => {
    let filtered = leaders;

    // Filter by region (cidade_id or localidade match)
    if (selectedRegion !== "all") {
      filtered = filtered.filter(l => {
        if (mapTenantConfig.useOfficeCities) {
          return l.cidade_id === selectedRegion;
        } else {
          // localidade mode: selectedRegion is the localidade string
          return l.localidade === selectedRegion || l.cidade_nome === selectedRegion;
        }
      });
    }

    // Filter by leader/coordinator selection
    if (selectedLeader !== "all") {
      const selected = leaders.find(l => l.id === selectedLeader);
      if (selected) {
        if (selected.is_coordinator) {
          // Show coordinator + all their subordinates
          const subordinateIds = new Set(
            leaders.filter(l => l.parent_leader_id === selectedLeader).map(l => l.id)
          );
          filtered = filtered.filter(l => l.id === selectedLeader || subordinateIds.has(l.id));
        } else {
          filtered = filtered.filter(l => l.id === selectedLeader);
        }
      }
    }

    return filtered;
  }, [leaders, selectedRegion, selectedLeader, mapTenantConfig.useOfficeCities]);

  // ── B2: Filter contacts by region AND leader ──
  const visibleContacts = useMemo(() => {
    let filtered = contacts;

    // Filter by region
    if (selectedRegion !== "all") {
      filtered = filtered.filter(c => {
        if (mapTenantConfig.useOfficeCities) {
          return c.cidade_id === selectedRegion;
        } else {
          return c.localidade === selectedRegion || c.cidade_nome === selectedRegion;
        }
      });
    }

    // Filter by leader (show only contacts linked to visible leaders)
    if (selectedLeader !== "all") {
      const visibleLeaderIds = new Set(visibleLeaders.map(l => l.id));
      filtered = filtered.filter(c =>
        c.source_type !== "lider" || !c.source_id || visibleLeaderIds.has(c.source_id)
      );
    }

    return filtered;
  }, [contacts, selectedRegion, selectedLeader, visibleLeaders, mapTenantConfig.useOfficeCities]);

  // ── Calculate spread positions ──
  const leaderPositions = useMemo(() => {
    const coordinators = visibleLeaders.filter(l => l.is_coordinator);
    const regularLeaders = visibleLeaders.filter(l => !l.is_coordinator);
    const positions = new Map<string, { lat: number; lng: number }>();
    const coordPositions = getPositionsByCity(coordinators, 'coordinator');
    coordPositions.forEach((pos, id) => positions.set(id, pos));
    const leaderPos = getPositionsByCity(regularLeaders, 'leader');
    leaderPos.forEach((pos, id) => positions.set(id, pos));
    return positions;
  }, [visibleLeaders]);

  const contactPositions = useMemo(() => getPositionsByCity(visibleContacts, 'contact'), [visibleContacts]);

  // ── U4: Stats that reflect the active filter ──
  const filteredStats = useMemo(() => ({
    coordinatorsCount: visibleLeaders.filter(l => l.is_coordinator).length,
    leadersCount: visibleLeaders.filter(l => !l.is_coordinator).length,
    contactsCount: visibleContacts.length,
    connectionsCount: visibleContacts.filter(c => c.source_type === "lider" && c.source_id).length
      + visibleLeaders.filter(l => l.parent_leader_id).length,
  }), [visibleLeaders, visibleContacts]);

  const isFiltered = selectedRegion !== "all" || selectedLeader !== "all";
  const totalStats = useMemo(() => ({
    coordinatorsCount: stats?.coordinatorsCount ?? 0,
    leadersCount: stats?.leadersCount ?? 0,
    contactsCount: stats?.contactsCount ?? 0,
  }), [stats]);

  // ── Map center / zoom based on filters ──
  const selectedCity = useMemo(() => {
    if (selectedRegion === "all") return null;
    return cities.find(c => c.id === selectedRegion) || null;
  }, [selectedRegion, cities]);

  const uniqueLocalidades = useMemo(() => {
    if (mapTenantConfig.useOfficeCities) return [];
    const locs = new Set<string>();
    leaders.forEach(l => { if (l.localidade) locs.add(l.localidade); });
    contacts.forEach(c => { if (c.localidade) locs.add(c.localidade); });
    return Array.from(locs).sort();
  }, [leaders, contacts, mapTenantConfig.useOfficeCities]);

  const mapCenter = useMemo<[number, number]>(() => {
    if (selectedRegion === "all") return mapTenantConfig.center;
    if (mapTenantConfig.useOfficeCities && selectedCity) {
      if (selectedCity.codigo_ra) {
        const boundaryCenter = getRACenter(selectedCity.codigo_ra);
        if (boundaryCenter) return boundaryCenter;
      }
      if (selectedCity.latitude && selectedCity.longitude)
        return [selectedCity.latitude, selectedCity.longitude];
    }
    if (!mapTenantConfig.useOfficeCities && selectedCity)
      return [selectedCity.latitude, selectedCity.longitude];
    return mapTenantConfig.center;
  }, [selectedRegion, selectedCity, mapTenantConfig]);

  const mapZoom = useMemo(() => {
    if (selectedRegion === "all") return mapTenantConfig.zoom;
    if (mapTenantConfig.useOfficeCities && selectedCity?.codigo_ra)
      return getRAZoomLevel(selectedCity.codigo_ra);
    return CITY_ZOOM;
  }, [selectedRegion, selectedCity, mapTenantConfig]);

  const sortedCities = useMemo(() =>
    [...cities].filter(c => c.latitude && c.longitude).sort((a, b) => a.nome.localeCompare(b.nome)),
    [cities]
  );

  // Detail panel contacts
  const leaderDetailContacts = useMemo(() => {
    if (!selectedLeaderDetail) return [];
    return contacts.filter(c => c.source_type === "lider" && c.source_id === selectedLeaderDetail.id);
  }, [contacts, selectedLeaderDetail]);

  // ── Responsive map height ──
  const mapHeight = isFullscreen ? "calc(100vh - 4px)" : "min(70vh, 680px)";

  // ── Loading skeleton ──
  if (isLoading && !isDemoMode) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg"><MapIcon className="h-6 w-6 text-primary" /></div>
          <div><Skeleton className="h-7 w-48 mb-1" /><Skeleton className="h-4 w-72" /></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                <div className="flex-1"><Skeleton className="h-3 w-20 mb-2" /><Skeleton className="h-6 w-12" /></div>
              </div>
            </CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-5 w-9 rounded-full" /><Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent></Card>
        <div className="relative">
          <Skeleton className="h-[600px] w-full rounded-lg" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground font-medium">Carregando mapa estratégico...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !isDemoMode) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <Card className="border-destructive"><CardContent className="pt-6">
          <p className="text-destructive">Erro ao carregar dados do mapa: {(error as Error).message}</p>
        </CardContent></Card>
      </div>
    );
  }

  const currentStyle = MAP_STYLES[mapStyle];

  return (
    <div className={`space-y-6 ${isFullscreen ? "fixed inset-0 z-50 bg-background overflow-auto p-4" : "p-4 sm:p-6 max-w-7xl mx-auto"}`}>
      <TutorialOverlay page="strategic-map" />

      {/* ── Header ── */}
      <div data-tutorial="map-header" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg"><MapIcon className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mapa Estratégico</h1>
            <p className="text-muted-foreground text-sm">{mapTenantConfig.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <TutorialButton onClick={restartTutorial} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen(f => !f)}
            className="gap-1.5"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {isFullscreen ? "Sair" : "Tela Cheia"}
          </Button>
        </div>
      </div>

      {/* ── Stats (U4: reflect filter) ── */}
      <div data-tutorial="map-stats" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            icon: Crown, label: "Coordenadores", color: "text-yellow-500 bg-yellow-50 dark:bg-yellow-950/30",
            value: isFiltered ? filteredStats.coordinatorsCount : totalStats.coordinatorsCount,
            total: isFiltered ? totalStats.coordinatorsCount : null,
            key: "coord"
          },
          {
            icon: Star, label: "Líderes", color: "text-blue-500 bg-blue-50 dark:bg-blue-950/30",
            value: isFiltered ? filteredStats.leadersCount : totalStats.leadersCount,
            total: isFiltered ? totalStats.leadersCount : null,
            key: "ldr"
          },
          {
            icon: Users, label: "Contatos", color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
            value: isFiltered ? filteredStats.contactsCount : totalStats.contactsCount,
            total: isFiltered ? totalStats.contactsCount : null,
            key: "ctc"
          },
          {
            icon: Link2, label: "Conexões", color: "text-purple-500 bg-purple-50 dark:bg-purple-950/30",
            value: filteredStats.connectionsCount,
            total: null,
            key: "conn"
          },
        ].map(s => (
          <Card key={s.key}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{s.label}</p>
                  <p className="text-xl font-bold">{m.number(s.value, "stat_" + s.key)}</p>
                  {s.total !== null && isFiltered && (
                    <p className="text-xs text-muted-foreground">de {m.number(s.total, "stat_tot_" + s.key)}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Controls ── */}
      <Card data-tutorial="map-controls">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">

            {/* Map Style */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Estilo:</Label>
              <select
                value={mapStyle}
                onChange={e => setMapStyle(e.target.value as MapStyleKey)}
                className="h-8 px-2 rounded-md border border-input bg-background text-sm"
              >
                <option value="standard">Padrão</option>
                <option value="clean">Clean</option>
                <option value="grayscale">Cinza</option>
                <option value="dark">Dark</option>
              </select>
            </div>

            {/* Region filter */}
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={selectedRegion} onValueChange={v => { setSelectedRegion(v); setSelectedLeaderDetail(null); }}>
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue placeholder={mapTenantConfig.regionLabel} />
                </SelectTrigger>
                <SelectContent className="z-[9999] max-h-[300px]">
                  <SelectItem value="all">Todas as regiões</SelectItem>
                  {mapTenantConfig.useOfficeCities
                    ? sortedCities.map(city => (
                        <SelectItem key={city.id} value={city.id}>{city.nome}</SelectItem>
                      ))
                    : uniqueLocalidades.map(loc => (
                        <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>

            {/* U5: Leader filter with search */}
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select
                value={selectedLeader}
                onValueChange={v => { setSelectedLeader(v); setLeaderSearch(""); setSelectedLeaderDetail(null); }}
              >
                <SelectTrigger className="w-[220px] h-8">
                  <SelectValue placeholder="Filtrar por Líder" />
                </SelectTrigger>
                <SelectContent className="z-[9999] max-h-[420px]">
                  {/* Search inside dropdown */}
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        className="pl-7 h-7 text-xs"
                        placeholder="Buscar líder..."
                        value={leaderSearch}
                        onChange={e => setLeaderSearch(e.target.value)}
                        onKeyDown={e => e.stopPropagation()}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <SelectItem value="all">Todos os Líderes</SelectItem>
                  {leaderOptions.coordinators.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs text-muted-foreground font-semibold border-t mt-1">
                        👑 Coordenadores ({leaderOptions.coordinators.length})
                      </div>
                      {leaderOptions.coordinators.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          👑 {isDemoMode ? m.name(c.nome_completo) : c.nome_completo}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {leaderOptions.regularLeaders.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs text-muted-foreground font-semibold border-t mt-1">
                        ⭐ Líderes ({leaderOptions.regularLeaders.length})
                      </div>
                      {leaderOptions.regularLeaders.map(l => (
                        <SelectItem key={l.id} value={l.id}>
                          ⭐ {isDemoMode ? m.name(l.nome_completo) : l.nome_completo}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {leaderOptions.coordinators.length === 0 && leaderOptions.regularLeaders.length === 0 && (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">Nenhum resultado</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Active filter chips */}
            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => { setSelectedRegion("all"); setSelectedLeader("all"); setLeaderSearch(""); setSelectedLeaderDetail(null); }}
              >
                <X className="h-3 w-3" /> Limpar filtros
              </Button>
            )}

            <div className="h-6 w-px bg-border hidden sm:block" />

            {/* Layer toggles */}
            {[
              { id: "leaders", checked: showLeaders, onChange: setShowLeaders, color: "bg-blue-500", label: "Líderes" },
              { id: "contacts", checked: showContacts, onChange: setShowContacts, color: "bg-emerald-500", label: "Contatos" },
              { id: "connections", checked: showConnections, onChange: setShowConnections, icon: <Link2 className="h-3.5 w-3.5 text-purple-500" />, label: "Conexões" },
              { id: "heatmap", checked: showHeatmap, onChange: setShowHeatmap, icon: <Flame className="h-3.5 w-3.5 text-orange-500" />, label: "Mapa de Calor" },
            ].map(t => (
              <div key={t.id} className="flex items-center gap-2">
                <Switch id={`show-${t.id}`} checked={t.checked} onCheckedChange={t.onChange} />
                <Label htmlFor={`show-${t.id}`} className="flex items-center gap-1.5 cursor-pointer text-sm">
                  {t.icon ?? <div className={`w-3 h-3 rounded-full ${t.color}`} />}
                  {t.label}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Region Stats (N2) ── */}
      {selectedRegion !== "all" && selectedCity && (
        <RegionStatsCard
          regionName={selectedCity.nome}
          leaders={visibleLeaders}
          contacts={visibleContacts}
          isDemoMode={isDemoMode}
          m={m}
        />
      )}

      {/* ── Map ── */}
      <Card data-tutorial="map-container" className="overflow-hidden" ref={mapContainerRef}>
        <CardContent className="p-0">
          <div className="relative" style={{ height: mapHeight }}>
            <div className={`h-full w-full ${currentStyle.className}`}>
              <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                className="h-full w-full"
                scrollWheelZoom={true}
              >
                <MapController center={mapCenter} zoom={mapZoom} />
                <TileLayer attribution={currentStyle.attribution} url={currentStyle.url} />

                {/* Region Boundary Layer (DF mode) */}
                {mapTenantConfig.showRABoundaries && (
                  <RegionBoundaryLayer
                    selectedRegionCode={selectedCity?.codigo_ra || null}
                    selectedRegionName={selectedCity?.nome || null}
                    enabled={selectedRegion !== "all"}
                  />
                )}

                {/* Heatmap */}
                <HeatmapLayer contacts={visibleContacts} enabled={showHeatmap} />

                {/* Hierarchy connections */}
                <HierarchyConnectionsLayer
                  leaders={visibleLeaders}
                  leaderPositions={leaderPositions}
                  enabled={showConnections}
                />

                {/* Leader→Contact connections: B4 only show if contacts layer also active */}
                <ConnectionsLayer
                  leaders={visibleLeaders}
                  contacts={visibleContacts}
                  leaderPositions={leaderPositions}
                  contactPositions={contactPositions}
                  enabled={showConnections && showContacts}
                />

                {/* Leader / Coordinator pins */}
                {showLeaders && visibleLeaders.map((leader) => {
                  const pos = leaderPositions.get(leader.id);
                  if (!pos) return null;
                  const color = getLeaderColor(leader.id);
                  const isHighlighted = selectedLeaderDetail?.id === leader.id;
                  const icon = leader.is_coordinator
                    ? createCrownIcon(color, isHighlighted)
                    : createStarIcon(color, isHighlighted);
                  return (
                    <Marker
                      key={`leader-pin-${leader.id}`}
                      position={[pos.lat, pos.lng]}
                      icon={icon}
                      eventHandlers={{
                        click: () => setSelectedLeaderDetail(prev =>
                          prev?.id === leader.id ? null : leader
                        ),
                      }}
                    >
                      <Popup>
                        <div className="text-sm min-w-[160px]">
                          <p className="font-semibold">{m.name(leader.nome_completo)}</p>
                          <p className="text-xs text-muted-foreground">{leader.is_coordinator ? "Coordenador" : "Líder"}</p>
                          <p className="mt-1 text-xs">📍 {m.city(leader.localidade || leader.cidade_nome)}</p>
                          <button
                            className="mt-2 text-xs text-primary underline flex items-center gap-1"
                            onClick={() => setSelectedLeaderDetail(leader)}
                          >
                            Ver detalhes <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {/* Contact pins */}
                {showContacts && visibleContacts.map((contact) => {
                  const pos = contactPositions.get(contact.id);
                  if (!pos) return null;
                  const hasConnection = contact.source_type === "lider" && contact.source_id;
                  const pinColor = hasConnection ? getLeaderColor(contact.source_id!) : "#10b981";
                  return (
                    <CircleMarker
                      key={`contact-${contact.id}`}
                      center={[pos.lat, pos.lng]}
                      radius={hasConnection ? 5 : 4}
                      pathOptions={{
                        color: hasConnection ? "#ffffff" : pinColor,
                        weight: hasConnection ? 1.5 : 1,
                        fillColor: pinColor,
                        fillOpacity: 0.8,
                      }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <p className="font-semibold">{m.name(contact.nome)}</p>
                          <p className="text-muted-foreground">{m.city(contact.localidade || contact.cidade_nome)}</p>
                          {contact.source_type && (
                            <p className="text-xs mt-1">Origem: {contact.source_type}</p>
                          )}
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>

            {/* N1: Leader Detail Panel (absolute inside map) */}
            {selectedLeaderDetail && (
              <LeaderDetailPanel
                leader={selectedLeaderDetail}
                allLeaders={leaders}
                contactsForLeader={leaderDetailContacts}
                onClose={() => setSelectedLeaderDetail(null)}
                isDemoMode={isDemoMode}
                m={m}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Legend ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Legenda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <div className="flex items-center gap-2"><span className="text-xl">👑</span><span>Coordenador</span></div>
            <div className="flex items-center gap-2"><span className="text-xl">⭐</span><span>Líder</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span>Contato</span></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5" style={{ borderTop: "3px dashed hsl(270, 70%, 50%)" }} />
              <span>Hierarquia</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5" style={{ borderTop: "2px dashed hsl(150, 70%, 50%)" }} />
              <span>Indicação</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 rounded bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 opacity-50" />
              <span>Mapa de calor</span>
            </div>
            {mapTenantConfig.showRABoundaries && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-3 border-2 border-dashed border-primary bg-primary/10 rounded" />
                <span>Limite da RA</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <span className="italic">Clique no pin de um líder para abrir o painel de detalhes →</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── AI Analysis Panel ── */}
      <MapAnalysisPanel
        cities={cities}
        totalLeaders={m.number(isFiltered ? filteredStats.leadersCount + filteredStats.coordinatorsCount : (leaders.length), "map_al")}
        totalContacts={m.number(isFiltered ? filteredStats.contactsCount : contacts.length, "map_ac")}
        totalConnections={m.number(filteredStats.connectionsCount, "map_aconn")}
      />
    </div>
  );
}
