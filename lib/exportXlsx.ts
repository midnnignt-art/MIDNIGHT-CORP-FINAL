/**
 * Helper minimalista para exportar reportes XLSX desde el browser.
 *
 * Usa `exceljs` (mantenido, sin CVEs) en lugar de `xlsx` (sheetjs CE),
 * que tiene Prototype Pollution + ReDoS sin fix upstream.
 *
 * Carga `exceljs` dinámicamente para no inflar el bundle inicial.
 */

export interface SheetSpec<Row extends Record<string, any> = Record<string, any>> {
  name: string;
  rows: Row[];
  columns?: { key: string; header: string; width?: number }[];
}

/**
 * Construye un workbook con una o más hojas y dispara la descarga.
 *
 * - Si `columns` se pasa, se usan como header (en el orden dado) y se aplican
 *   anchos de columna. Si no, se infieren las columnas de las keys de la
 *   primera fila.
 * - Para hojas que son una matriz simple (sin headers, ej. metadata), pasar
 *   `rows` como `Record` con keys arbitrarias y NO pasar `columns`; cada
 *   fila se serializa según sus values en el orden de las keys.
 */
export async function exportXlsx(filename: string, sheets: SheetSpec[]): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name);

    if (sheet.columns && sheet.columns.length > 0) {
      ws.columns = sheet.columns.map(c => ({
        header: c.header,
        key: c.key,
        width: c.width ?? 14,
      }));
      ws.addRows(sheet.rows);
    } else if (sheet.rows.length > 0) {
      // Modo simple: cada fila es un Record cuyos values van en orden de keys.
      const firstRow = sheet.rows[0];
      const keys = Object.keys(firstRow);
      keys.forEach((k, i) => {
        const col = ws.getColumn(i + 1);
        col.width = 22;
        if (!Number.isNaN(Number(k))) return; // skip si la key es numérica
      });
      sheet.rows.forEach(r => {
        ws.addRow(keys.map(k => r[k]));
      });
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
