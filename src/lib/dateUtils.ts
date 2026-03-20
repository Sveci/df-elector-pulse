export function formatRelativeTime(date: string | null): string {
  if (!date) return "Nunca";

  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) return "Há poucos segundos";

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `Há ${diffInMinutes} min`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Há ${diffInHours}h`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `Há ${diffInDays}d`;

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) return `Há ${diffInWeeks} sem`;

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `Há ${diffInMonths} mês${diffInMonths > 1 ? "es" : ""}`;

  const diffInYears = Math.floor(diffInDays / 365);
  return `Há ${diffInYears} ano${diffInYears > 1 ? "s" : ""}`;
}
