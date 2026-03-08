import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeaderLevel {
  name: string;
  min: number;
  max: number;
  icon: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

const DEFAULT_LEVELS: LeaderLevel[] = [
  { 
    name: 'Bronze', 
    min: 0, 
    max: 10, 
    icon: '🥉', 
    colorClass: 'text-amber-700',
    bgClass: 'bg-amber-100',
    borderClass: 'border-amber-300'
  },
  { 
    name: 'Prata', 
    min: 11, 
    max: 30, 
    icon: '🥈', 
    colorClass: 'text-gray-600',
    bgClass: 'bg-gray-100',
    borderClass: 'border-gray-300'
  },
  { 
    name: 'Ouro', 
    min: 31, 
    max: 50, 
    icon: '🥇', 
    colorClass: 'text-yellow-700',
    bgClass: 'bg-yellow-100',
    borderClass: 'border-yellow-400'
  },
  { 
    name: 'Diamante', 
    min: 51, 
    max: Infinity, 
    icon: '💎', 
    colorClass: 'text-blue-700',
    bgClass: 'bg-blue-100',
    borderClass: 'border-blue-400'
  },
];

interface OfficeSettingsLevels {
  nivel_bronze_min: number;
  nivel_bronze_max: number;
  nivel_prata_min: number;
  nivel_prata_max: number;
  nivel_ouro_min: number;
  nivel_ouro_max: number;
  nivel_diamante_min: number;
  limite_eventos_dia: number;
}

function buildLevelsFromSettings(settings: OfficeSettingsLevels | null): LeaderLevel[] {
  if (!settings) return DEFAULT_LEVELS;
  
  return [
    { 
      name: 'Bronze', 
      min: settings.nivel_bronze_min ?? 0, 
      max: settings.nivel_bronze_max ?? 10, 
      icon: '🥉', 
      colorClass: 'text-amber-700',
      bgClass: 'bg-amber-100',
      borderClass: 'border-amber-300'
    },
    { 
      name: 'Prata', 
      min: settings.nivel_prata_min ?? 11, 
      max: settings.nivel_prata_max ?? 30, 
      icon: '🥈', 
      colorClass: 'text-gray-600',
      bgClass: 'bg-gray-100',
      borderClass: 'border-gray-300'
    },
    { 
      name: 'Ouro', 
      min: settings.nivel_ouro_min ?? 31, 
      max: settings.nivel_ouro_max ?? 50, 
      icon: '🥇', 
      colorClass: 'text-yellow-700',
      bgClass: 'bg-yellow-100',
      borderClass: 'border-yellow-400'
    },
    { 
      name: 'Diamante', 
      min: settings.nivel_diamante_min ?? 51, 
      max: Infinity, 
      icon: '💎', 
      colorClass: 'text-blue-700',
      bgClass: 'bg-blue-100',
      borderClass: 'border-blue-400'
    },
  ];
}

export function useLeaderLevels() {
  return useQuery({
    queryKey: ["leader_levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("office_settings")
        .select("*")
        .single();
      
      if (error) {
        console.error("Error fetching leader levels:", error);
        return DEFAULT_LEVELS;
      }
      
      // Cast to unknown first then to our type since the columns are new
      const settings = data as unknown as OfficeSettingsLevels;
      return buildLevelsFromSettings(settings);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface GamificationSettings {
  nivel_bronze_min: number;
  nivel_bronze_max: number;
  nivel_prata_min: number;
  nivel_prata_max: number;
  nivel_ouro_min: number;
  nivel_ouro_max: number;
  nivel_diamante_min: number;
  limite_eventos_dia: number;
  pontos_form_submitted: number;
  pontos_aceita_reuniao: number;
}

export function useGamificationSettings() {
  return useQuery({
    queryKey: ["gamification_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("office_settings")
        .select("*")
        .single();
      
      if (error) throw error;
      // Cast to unknown first then to our type since the columns are new
      return data as unknown as GamificationSettings;
    },
  });
}

// Helper functions that work with dynamic levels
export function getLeaderLevel(points: number, levels?: LeaderLevel[]): LeaderLevel {
  const safeLevels = levels && levels.length > 0 ? levels : DEFAULT_LEVELS;
  return safeLevels.find(l => points >= l.min && points <= l.max) || safeLevels[0];
}

export function getNextLevel(points: number, levels?: LeaderLevel[]): LeaderLevel | null {
  const safeLevels = levels && levels.length > 0 ? levels : DEFAULT_LEVELS;
  const currentLevel = getLeaderLevel(points, safeLevels);
  const currentIndex = safeLevels.findIndex(l => l.name === currentLevel.name);
  if (currentIndex < safeLevels.length - 1) {
    return safeLevels[currentIndex + 1];
  }
  return null;
}

export function getProgressToNextLevel(points: number, levels?: LeaderLevel[]): number {
  const safeLevels = levels && levels.length > 0 ? levels : DEFAULT_LEVELS;
  const currentLevel = getLeaderLevel(points, safeLevels);
  const nextLevel = getNextLevel(points, safeLevels);
  
  if (!nextLevel) return 100;
  
  const progressInLevel = points - currentLevel.min;
  const levelRange = currentLevel.max - currentLevel.min + 1;
  
  return Math.min(100, Math.round((progressInLevel / levelRange) * 100));
}

export function getPointsToNextLevel(points: number, levels?: LeaderLevel[]): number {
  const safeLevels = levels && levels.length > 0 ? levels : DEFAULT_LEVELS;
  const nextLevel = getNextLevel(points, safeLevels);
  if (!nextLevel) return 0;
  return nextLevel.min - points;
}

export function getLeaderCardColorClass(points: number, levels?: LeaderLevel[]): string {
  const level = getLeaderLevel(points, levels);
  return `border-l-4 ${level.borderClass} ${level.bgClass.replace('100', '50')}/50`;
}

export { DEFAULT_LEVELS };
