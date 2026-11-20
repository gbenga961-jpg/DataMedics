/**
 * Spreadsheet-Safe Export Engine (PRD §11, §18, Amendment J04)
 *
 * Implements formula injection (CSV Injection / CWE-1236) neutralisation:
 * - CSV cell values are treated as untrusted input.
 * - Formulas are never executed or evaluated.
 * - Dangerous prefixes: '=', '+', '-', '@'.
 * - Checks for relevant leading ASCII/Unicode whitespace and control characters.
 * - Legitimate numeric values, including negative numbers, are reliably classified and preserved.
 * - Suspicious values are neutralised by prefixing with an apostrophe (').
 * - Affected cells are counted once per modified cell in exportProtectedValueCount.
 * - Canonical cleaned data is NEVER modified (immutability preserved).
 */

/**
 * Control characters and whitespace characters that may precede formula content.
 * Includes ASCII 0x00-0x1F, 0x7F, tabs, line breaks, and whitespace.
 */
const LEADING_CONTROL_OR_WS = /^[\s\x00-\x1f\x7f\u0080-\u009f\u2000-\u200b\u2028\u2029]+/;

/**
 * Characters that trigger formula execution in spreadsheet applications (Excel, LibreOffice, Google Sheets).
 */
const FORMULA_PREFIXES = new Set(["=", "+", "-", "@"]);

/**
 * Strict regex for confidently classified legitimate numeric values:
 * Optional sign (+ or -), digits, optional decimal point and digits, optional scientific exponent.
 * Examples: -42, -3.14, -0.005, -1.2e-4, +100, 42
 * Rejects formula expressions like -SUM(...), -cmd|..., --1, -+1, -1+2, etc.
 */
const LEGITIMATE_NUMBER_PATTERN = /^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/;

/**
 * Checks if a string value is a confidently classified legitimate number.
 * Must match the strict numeric pattern and contain no extraneous operators or text.
 */
export function isLegitimateNumber(val: string): boolean {
  return LEGITIMATE_NUMBER_PATTERN.test(val.trim());
}

/**
 * Inspects a cell value to determine whether it is potentially dangerous
 * and requires formula neutralisation.
 *
 * @param value The raw parsed cell string.
 * @returns true if the cell contains a dangerous formula prefix and is not a legitimate number.
 */
export function isDangerousFormulaValue(value: string): boolean {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  // Strip leading whitespace and control characters to inspect effective prefix
  const stripped = value.replace(LEADING_CONTROL_OR_WS, "");
  if (stripped.length === 0) {
    return false;
  }

  const firstChar = stripped[0];
  if (!FORMULA_PREFIXES.has(firstChar)) {
    return false;
  }

  // If it starts with + or -, check if it is a legitimate numeric value
  if (firstChar === "+" || firstChar === "-") {
    if (isLegitimateNumber(stripped)) {
      return false; // Safely classified legitimate number
    }
  }

  // Values starting with '=' or '@' or non-numeric '+' / '-' are dangerous
  return true;
}

/**
 * Neutralises a single cell value if dangerous, using the approved apostrophe prefix mitigation.
 * If already neutralised or safe, returns the value unchanged.
 */
export function neutralizeCellValue(value: string): { safeValue: string; modified: boolean } {
  if (isDangerousFormulaValue(value)) {
    return {
      safeValue: `'${value}`,
      modified: true,
    };
  }
  return {
    safeValue: value,
    modified: false,
  };
}

export interface NeutralizeFormulasResult {
  safeHeaders: string[];
  safeRows: string[][];
  exportProtectedValueCount: number;
}

/**
 * Neutralizes potentially dangerous formula values across all data cells.
 * Headers are preserved unchanged (PRD §11.4: preserve original header row).
 * Input arrays are deep-cloned to ensure canonical data remains immutable.
 *
 * @param headers Column headers (read-only)
 * @param rows Data rows (read-only)
 * @returns Safe representation and count of modified cells
 */
export function neutralizeFormulas(
  headers: string[],
  rows: string[][]
): NeutralizeFormulasResult {
  let exportProtectedValueCount = 0;

  // Clone headers
  const safeHeaders = headers.slice();

  // Clone and neutralize rows
  const safeRows: string[][] = rows.map((row) =>
    row.map((cell) => {
      const { safeValue, modified } = neutralizeCellValue(cell);
      if (modified) {
        exportProtectedValueCount++;
      }
      return safeValue;
    })
  );

  return {
    safeHeaders,
    safeRows,
    exportProtectedValueCount,
  };
}

/**
 * Generates an output filename based on the original upload name and timestamp.
 * PRD §11.4: Example: monthly_sales_cleaned_20261101_153000.csv
 */
export function generateCleanedFilename(
  originalFilename: string,
  date: Date = new Date()
): string {
  // Strip extension
  const base = originalFilename.replace(/\.[^/.]+$/, "");
  const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, "_") || "cleaned";

  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());

  const timestamp = `${yyyy}${MM}${dd}_${hh}${mm}${ss}`;
  return `${safeBase}_cleaned_${timestamp}.csv`;
}

export const EXPORT_SAFETY_DISCLOSURE =
  "Export safety: Potentially dangerous formula-like values (such as those starting with '=', '+', '-', or '@') are safely neutralized with an apostrophe in the downloadable file to protect spreadsheet applications. Your canonical cleaned data is preserved without alteration.";
