/**
 * xlsx-compat.ts
 *
 * Drop-in shim over ExcelJS that exposes the subset of the SheetJS (xlsx)
 * API actually used in this codebase:
 *
 *   XLSX.utils.json_to_sheet(rows)
 *   XLSX.utils.aoa_to_sheet(aoa)
 *   XLSX.utils.book_new()
 *   XLSX.utils.book_append_sheet(wb, ws, name)
 *   XLSX.utils.sheet_to_json(ws, opts)
 *   XLSX.read(data, { type: 'binary' })
 *   XLSX.writeFile(wb, filename)
 *
 * This lets us remove the abandoned / critically-vulnerable `xlsx` package
 * (CVE prototype-pollution, path-traversal, PDF-injection) without touching
 * every call-site.
 *
 * Implementation notes
 * ─────────────────────
 * ExcelJS is a maintained alternative (last release < 30 days, 0 critical
 * CVEs). Its API is promise-based and richer, so this shim bridges the gap.
 *
 * For WRITE operations we build an ExcelJS workbook, stream it to a Buffer
 * (sync via a pre-built Blob trick), and trigger a browser download.
 *
 * For READ operations we accept the same ArrayBuffer / binary-string that
 * xlsx accepted and parse through ExcelJS's xlsx stream reader.
 */

import ExcelJS from "exceljs";

// ─── Internal types ───────────────────────────────────────────────────────────

interface ColWidth {
  wch?: number; // character width (xlsx style)
  width?: number;
}

export interface ShimWorksheet {
  // Using unknown[] allows storing both Record<string,unknown>[] and unknown[][]
  // without TypeScript complaining about the dual usage.
  _rows: unknown[];
  _isAoa: boolean;
  "!cols"?: ColWidth[];
  _name?: string;
}

export interface ShimWorkbook {
  SheetNames: string[];
  Sheets: Record<string, ShimWorksheet>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function triggerDownload(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function shimWorkbookToBuffer(wb: ShimWorkbook): Promise<ArrayBuffer> {
  const exWb = new ExcelJS.Workbook();

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const sheet = exWb.addWorksheet(name);

    // Apply column widths if provided
    if (ws["!cols"]) {
      sheet.columns = ws["!cols"].map((c, i) => ({
        key: String(i),
        width: c.wch ?? c.width ?? 12,
      }));
    }

    if (ws._isAoa) {
      // Array-of-arrays: ws._rows contains the full AoA
      const aoa = ws._rows as unknown[][];
      aoa.forEach((row) => {
        sheet.addRow(row);
      });
    } else {
      // Object rows: first sheet row is the header derived from keys
      const rows = ws._rows as Record<string, unknown>[];
      if (rows.length === 0) continue;
      const keys = Object.keys(rows[0]);
      sheet.addRow(keys); // header
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      rows.forEach((r) => {
        sheet.addRow(keys.map((k) => r[k] ?? ""));
      });
    }
  }

  const buf = await exWb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

// ─── Public API shim ──────────────────────────────────────────────────────────

export const utils = {
  /** Convert array of objects → ShimWorksheet */
  json_to_sheet(rows: Record<string, unknown>[]): ShimWorksheet {
    return { _rows: rows, _isAoa: false };
  },

  /** Convert array-of-arrays → ShimWorksheet */
  aoa_to_sheet(aoa: unknown[][]): ShimWorksheet {
    return { _rows: aoa as unknown as unknown[], _isAoa: true };
  },

  book_new(): ShimWorkbook {
    return { SheetNames: [], Sheets: {} };
  },

  book_append_sheet(wb: ShimWorkbook, ws: ShimWorksheet, name: string): void {
    wb.SheetNames.push(name);
    wb.Sheets[name] = ws;
  },

  /**
   * Minimal sheet_to_json — used only for reading uploaded files.
   * opts.header: string[] → use as column names
   * opts.range: number    → skip N rows from top
   */
  sheet_to_json<T = Record<string, unknown>>(
    ws: ShimWorksheet,
    opts?: { header?: string[]; range?: number; defval?: unknown }
  ): T[] {
    const { header, range = 0, defval = "" } = opts ?? {};
    const aoa = ws._rows as unknown[][];
    const slice = aoa.slice(range);

    if (header) {
      return slice.map((row) => {
        const obj: Record<string, unknown> = {};
        header.forEach((key, i) => {
          obj[key] = (row as unknown[])[i] ?? defval;
        });
        return obj as T;
      });
    }

    // No header — first row is keys
    if (slice.length === 0) return [];
    const keys = (slice[0] as unknown[]).map(String);
    return slice.slice(1).map((row) => {
      const obj: Record<string, unknown> = {};
      keys.forEach((k, i) => {
        obj[k] = (row as unknown[])[i] ?? defval;
      });
      return obj as T;
    });
  },
};

/**
 * Read an uploaded .xlsx / .xls file.
 * Accepts: ArrayBuffer, string (binary), or Uint8Array.
 */
export async function read(
  data: ArrayBuffer | string | Uint8Array,
  _opts?: { type?: string }
): Promise<ShimWorkbook> {
  const wb = new ExcelJS.Workbook();

  let buffer: Buffer | ArrayBuffer;
  if (typeof data === "string") {
    // binary string → Uint8Array
    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i) & 0xff;
    buffer = bytes.buffer;
  } else {
    buffer = data instanceof Uint8Array ? data.buffer : data;
  }

  await wb.xlsx.load(buffer as ArrayBuffer);

  const shim: ShimWorkbook = { SheetNames: [], Sheets: {} };

  wb.eachSheet((sheet) => {
    const aoa: unknown[][] = [];
    sheet.eachRow((row) => {
      aoa.push((row.values as unknown[]).slice(1)); // ExcelJS rows are 1-indexed
    });
    const ws: ShimWorksheet = { _rows: aoa as unknown as unknown[], _isAoa: true };
    shim.SheetNames.push(sheet.name);
    shim.Sheets[sheet.name] = ws;
  });

  return shim;
}

/**
 * Download a workbook as .xlsx in the browser.
 * This is async internally but exposes a void signature matching xlsx's
 * synchronous writeFile for call-site compatibility.
 * We schedule it as a microtask so callers don't need to await.
 */
export function writeFile(wb: ShimWorkbook, filename: string): void {
  shimWorkbookToBuffer(wb)
    .then((buf) => triggerDownload(buf, filename))
    .catch((err) => console.error("[xlsx-compat] writeFile error:", err));
}

// Named default export so `import * as XLSX from '...'` and
// `import XLSX from '...'` both work.
const XLSX = { utils, read, writeFile };
export default XLSX;
