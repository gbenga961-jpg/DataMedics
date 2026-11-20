/**
 * RFC 4180-compliant canonical CSV serializer (PRD §9, §11, §18)
 * Rules:
 * - Fields containing commas, double-quotes, or newlines MUST be quoted.
 * - Double-quotes inside quoted fields are escaped as "".
 * - Lines are terminated with CRLF (\r\n) per RFC 4180.
 * - Never modifies values — only wraps them in correct quoting.
 *
 * This serializer produces the canonical cleaned output.
 * Formula injection protection (safe-export) is Milestone 5.
 */

const MUST_QUOTE = /[,"\r\n]/;

function quoteField(value: string): string {
  if (MUST_QUOTE.test(value)) {
    // Escape embedded double-quotes then wrap in quotes
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Serialize headers + data rows to canonical RFC 4180 CSV string.
 * @param headers Column header strings (assumed already trimmed / as-stored)
 * @param rows    Data rows (string[][] — no modification performed)
 * @returns       A UTF-8 string ready to write as a .csv file
 */
export function serializeToCanonicalCsv(headers: string[], rows: string[][]): string {
  const lines: string[] = [];

  // Header row
  lines.push(headers.map(quoteField).join(","));

  // Data rows
  for (const row of rows) {
    lines.push(row.map(quoteField).join(","));
  }

  // RFC 4180: CRLF line endings; trailing CRLF after last record
  return lines.join("\r\n") + "\r\n";
}
