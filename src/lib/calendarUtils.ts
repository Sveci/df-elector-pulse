/**
 * Utilitários para geração de arquivos de calendário (.ics)
 * Compatível com Google Calendar, Apple Calendar, Outlook, etc.
 */

export interface CalendarEventData {
  title: string;
  description?: string;
  location: string;
  address?: string;
  startDate: Date;
  endDate: Date;
  uid?: string;
}

/**
 * Formata uma data para o formato iCalendar (YYYYMMDDTHHMMSS)
 */
function formatICSDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

/**
 * Formata data atual em UTC para DTSTAMP
 */
function formatICSDateUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escapa caracteres especiais para o formato iCalendar
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Gera o conteúdo de um arquivo .ics (iCalendar RFC 5545)
 */
export function generateICSContent(event: CalendarEventData): string {
  const uid = event.uid || `evento-${Date.now()}@eleitor360.ai`;
  const now = new Date();

  // Combinar location e address
  const fullLocation = event.address
    ? `${event.location} - ${event.address}`
    : event.location;

  // Descrição com instrução sobre QR Code
  const description = event.description
    ? `${event.description}\\n\\nApresente seu QR Code na entrada para realizar o check-in.`
    : 'Apresente seu QR Code na entrada para realizar o check-in.';

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Eleitor360//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatICSDateUTC(now)}`,
    `DTSTART:${formatICSDate(event.startDate)}`,
    `DTEND:${formatICSDate(event.endDate)}`,
    `SUMMARY:${escapeICSText(event.title)}`,
    `DESCRIPTION:${escapeICSText(description)}`,
    `LOCATION:${escapeICSText(fullLocation)}`,
    // Lembrete 1 hora antes
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Evento em 1 hora - Não esqueça seu QR Code!',
    'END:VALARM',
    // Lembrete no dia do evento (9h antes, para evento às 19h lembra às 10h)
    'BEGIN:VALARM',
    'TRIGGER:-PT9H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Evento hoje! Prepare seu QR Code para o check-in.',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return icsContent;
}

/**
 * Faz o download do arquivo .ics
 */
export function downloadCalendarEvent(event: CalendarEventData, filename: string): void {
  const icsContent = generateICSContent(event);

  // Criar blob com o conteúdo
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });

  // Criar URL temporária
  const url = URL.createObjectURL(blob);

  // Criar link e fazer download
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.ics`;
  document.body.appendChild(link);
  link.click();

  // Limpar
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Cria as datas de início e fim a partir de uma data e hora de evento
 * @param dateStr Data no formato YYYY-MM-DD
 * @param timeStr Hora no formato HH:mm ou HH:mm:ss
 * @param durationHours Duração em horas (padrão: 2)
 */
export function createEventDates(
  dateStr: string,
  timeStr: string,
  durationHours: number = 2
): { startDate: Date; endDate: Date } {
  // Parsear data e hora
  const [year, month, day] = dateStr.split('-').map(Number);
  const timeParts = timeStr.split(':').map(Number);
  const hours = timeParts[0] || 0;
  const minutes = timeParts[1] || 0;

  // Criar data de início
  const startDate = new Date(year, month - 1, day, hours, minutes, 0);

  // Criar data de fim (adicionar duração)
  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + durationHours);

  return { startDate, endDate };
}
