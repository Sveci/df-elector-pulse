/**
 * Normaliza telefone brasileiro para formato E.164
 * @param phone Telefone em qualquer formato
 * @returns Telefone no formato +5561999999999
 */
export function normalizePhoneToE164(phone: string): string {
  // Remove tudo exceto números
  const digits = phone.replace(/\D/g, '');

  // Formato E.164: +5561999999999 (13 dígitos)
  if (digits.length === 11) {
    // 61987654321 -> +5561987654321
    return `+55${digits}`;
  } else if (digits.length === 13 && digits.startsWith('55')) {
    // 5561987654321 -> +5561987654321
    return `+${digits}`;
  } else if (digits.length === 13 && !digits.startsWith('55')) {
    throw new Error(`Telefone com 13 dígitos mas não começa com 55: ${phone}`);
  }

  throw new Error(`Telefone inválido: ${phone}. Formato esperado: (DD) 9XXXX-XXXX`);
}

/**
 * Formata telefone E.164 para formato brasileiro
 * @param phone Telefone no formato +5561999999999
 * @returns Telefone no formato (61) 99999-9999
 */
export function formatPhoneToBR(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const firstPart = digits.slice(4, 9);
    const secondPart = digits.slice(9, 13);
    return `(${ddd}) ${firstPart}-${secondPart}`;
  } else if (digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const firstPart = digits.slice(2, 7);
    const secondPart = digits.slice(7, 11);
    return `(${ddd}) ${firstPart}-${secondPart}`;
  }

  return phone;
}

/**
 * Valida se o telefone está em formato válido
 * @param phone Telefone em qualquer formato
 * @returns true se válido
 */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');

  // 11 dígitos (DDD + 9 + 8 dígitos) ou 13 (55 + DDD + 9 + 8)
  if (digits.length === 11) {
    return /^[1-9]{2}9[0-9]{8}$/.test(digits);
  } else if (digits.length === 13) {
    return /^55[1-9]{2}9[0-9]{8}$/.test(digits);
  }

  return false;
}
