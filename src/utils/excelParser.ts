import * as XLSX from '@/lib/xlsx-compat';

/**
 * Interface para os dados do líder importados do Excel
 */
export interface LeaderImportRow {
  nome_completo: string;
  whatsapp: string;
  data_nascimento?: string;
  status?: string;
  observacao?: string;
  email?: string;
}

/** Parse de arquivo Excel (.xlsx ou .xls) para array de objetos */
export async function parseExcelFile(file: File): Promise<LeaderImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = await XLSX.read(buffer, { type: 'binary' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<LeaderImportRow>(worksheet, {
    header: ['nome_completo', 'whatsapp', 'data_nascimento', 'status', 'observacao', 'email'],
    range: 1,
    defval: '',
  });
}

/** Gera um arquivo Excel modelo para importação de líderes */
export function generateLeadersTemplate(): void {
  const templateData = [
    { 'Nome Completo': 'João da Silva', 'WhatsApp': '5561999887766', 'Data de Nascimento': '15/03/1985', 'Status': 'ativo', 'Observação': 'Líder comunitário experiente', 'Email': 'joao.silva@email.com' },
    { 'Nome Completo': 'Maria Santos', 'WhatsApp': '5561988776655', 'Data de Nascimento': '', 'Status': '', 'Observação': '', 'Email': '' },
  ];
  const ws = XLSX.utils.json_to_sheet(templateData);
  ws['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 35 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Líderes');
  XLSX.writeFile(wb, 'modelo_importacao_lideres.xlsx');
}

/** Valida a estrutura básica dos dados importados */
export function validateImportData(data: LeaderImportRow[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || data.length === 0) {
    errors.push('Arquivo vazio ou sem dados válidos');
    return { isValid: false, errors };
  }
  const valid = (v: unknown) => v !== null && v !== undefined && String(v).trim().length > 0;
  data.forEach((row, i) => {
    const line = i + 2;
    if (!valid(row.nome_completo)) errors.push(`Linha ${line}: Nome completo é obrigatório`);
    if (!valid(row.whatsapp)) errors.push(`Linha ${line}: WhatsApp é obrigatório`);
  });
  return { isValid: errors.length === 0, errors };
}

/**
 * Interface para os dados de contato importados do Excel
 */
export interface ContactImportRow {
  nome_completo: string;
  whatsapp: string;
  data_nascimento?: string;
  endereco?: string;
  observacao?: string;
  cidade?: string;
}

/** Parse de arquivo Excel (.xlsx ou .xls) para contatos */
export async function parseContactsExcelFile(file: File): Promise<ContactImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = await XLSX.read(buffer, { type: 'binary' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<ContactImportRow>(worksheet, {
    header: ['nome_completo', 'whatsapp', 'data_nascimento', 'endereco', 'observacao', 'cidade'],
    range: 1,
    defval: '',
  });
}

/** Gera um arquivo Excel modelo para importação de contatos */
export function generateContactsTemplate(): void {
  const templateData = [
    { 'Nome Completo': 'Ana Silva', 'WhatsApp': '5561987654321', 'Data de Nascimento': '15/03/1985', 'Endereço': 'QNN 14 Bloco A', 'Observação': 'Interessado em agricultura', 'Cidade': 'Ceilândia' },
    { 'Nome Completo': 'Carlos Santos', 'WhatsApp': '61988776655', 'Data de Nascimento': '20/07/1990', 'Endereço': 'QNM 28 Conjunto J', 'Observação': 'Participa de eventos comunitários', 'Cidade': 'Brasília' },
  ];
  const ws = XLSX.utils.json_to_sheet(templateData);
  ws['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 30 }, { wch: 35 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Contatos');
  XLSX.writeFile(wb, 'modelo_importacao_contatos.xlsx');
}

/** Valida a estrutura dos dados de contatos importados */
export function validateContactImportData(data: ContactImportRow[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || data.length === 0) {
    errors.push('Arquivo vazio ou sem dados válidos');
    return { isValid: false, errors };
  }
  const valid = (v: unknown) => v !== null && v !== undefined && String(v).trim().length > 0;
  data.forEach((row, i) => {
    const line = i + 2;
    if (!valid(row.nome_completo)) errors.push(`Linha ${line}: Nome completo é obrigatório`);
    if (!valid(row.whatsapp)) errors.push(`Linha ${line}: WhatsApp é obrigatório`);
    if (!valid(row.data_nascimento)) errors.push(`Linha ${line}: Data de nascimento é obrigatória`);
    if (!valid(row.endereco)) errors.push(`Linha ${line}: Endereço é obrigatório`);
  });
  return { isValid: errors.length === 0, errors };
}
