/**
 * Utilitário para parsing e validação de datas em múltiplos formatos
 */

/**
 * Converte uma data em diversos formatos para o formato YYYY-MM-DD
 * Aceita: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, YYYY/MM/DD, timestamps Excel
 */
export function parseDate(dateInput: string | number | Date): string | null {
  if (!dateInput) return null;

  try {
    let date: Date;

    // Se for um número (timestamp Excel)
    if (typeof dateInput === 'number') {
      // Excel dates são dias desde 1899-12-30
      const excelEpoch = new Date(1899, 11, 30);
      date = new Date(excelEpoch.getTime() + dateInput * 86400000);
    }
    // Se já for uma instância de Date
    else if (dateInput instanceof Date) {
      date = dateInput;
    }
    // Se for string
    else {
      const dateStr = String(dateInput).trim();

      // Tenta diversos formatos
      // DD/MM/YYYY ou DD-MM-YYYY
      const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
      if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch;
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      // YYYY-MM-DD ou YYYY/MM/DD
      else if (dateStr.match(/^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}$/)) {
        date = new Date(dateStr);
      }
      // ISO string
      else {
        date = new Date(dateStr);
      }
    }

    // Validar se a data é válida
    if (isNaN(date.getTime())) {
      return null;
    }

    // Formatar para YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    return null;
  }
}

/**
 * Valida se uma data de nascimento está dentro de um range razoável
 * Idade mínima: 16 anos
 * Idade máxima: 120 anos
 */
export function isValidBirthDate(dateStr: string): boolean {
  if (!dateStr) return false;

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;

  const today = new Date();
  const minDate = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate());
  const maxDate = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate());

  return date >= minDate && date <= maxDate;
}

/**
 * Calcula a idade com base na data de nascimento
 */
export function calculateAge(birthDate: string): number | null {
  if (!birthDate) return null;

  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}
