export interface ParsedCSV<T> {
  data: T[];
  errors: Array<{ row: number; message: string }>;
}

export function parseCSV<T = Record<string, string>>(
  csvContent: string,
  requiredFields: string[]
): ParsedCSV<T> {
  const lines = csvContent.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    return {
      data: [],
      errors: [{ row: 0, message: 'Arquivo CSV vazio' }],
    };
  }

  // Parse header
  const header = lines[0].split(',').map(h => h.trim());

  // Verificar campos obrigatórios
  const missingFields = requiredFields.filter(field => !header.includes(field));
  if (missingFields.length > 0) {
    return {
      data: [],
      errors: [{
        row: 1,
        message: `Campos obrigatórios faltando: ${missingFields.join(', ')}`,
      }],
    };
  }

  const data: T[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map(v => v.trim());

    if (values.length !== header.length) {
      errors.push({
        row: i + 1,
        message: `Número de colunas incorreto. Esperado ${header.length}, encontrado ${values.length}`,
      });
      continue;
    }

    const row: Record<string, string> = {};
    header.forEach((key, index) => {
      row[key] = values[index];
    });

    data.push(row as T);
  }

  return { data, errors };
}

export function generateCSVTemplate(fields: Array<{ name: string; example: string }>): string {
  const header = fields.map(f => f.name).join(',');
  const exampleRow = fields.map(f => f.example).join(',');
  return `${header}\n${exampleRow}`;
}

export function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
