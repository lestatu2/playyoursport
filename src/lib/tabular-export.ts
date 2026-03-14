import { Paragraph, TableCell, TableRow, TextRun } from 'docx'

export function toWorksheetRecord(headers: string[], row: unknown[]): Record<string, string> {
  const record: Record<string, string> = {}
  headers.forEach((header, index) => {
    record[header] = String(row[index] ?? '')
  })
  return record
}

export function buildDocxTableRows(headers: string[], bodyRows: unknown[][]): TableRow[] {
  return [
    new TableRow({
      children: headers.map((header) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })],
        })),
    }),
    ...bodyRows.map((row) =>
      new TableRow({
        children: row.map((value) =>
          new TableCell({
            children: [new Paragraph(String(value ?? ''))],
          })),
      })),
  ]
}
