/**
 * CSV Structural Validator
 * Implements PRD §7, §7.8, and J02 amendments.
 * Provides stable validation error codes and safe user messages.
 */

import { parseCsv, CsvParserError, ParseResult } from "./parser";
import { getConfig } from "@/lib/config";

export interface ValidationSuccess {
  isValid: true;
  headers: string[];
  rows: string[][];
  rowCount: number;
  columnCount: number;
  hasBom: boolean;
  ignoredBlankRowCount: number;
}

export interface ValidationFailure {
  isValid: false;
  errorCode: string;
  errorMessage: string;
  details?: Record<string, unknown>;
}

export type ValidationOutcome = ValidationSuccess | ValidationFailure;

/**
 * Checks whether a row is completely blank (all fields are empty or whitespace-only).
 */
export function isFullyBlankRow(row: string[]): boolean {
  if (row.length === 0) return true;
  return row.every((cell) => cell.trim().length === 0);
}

/**
 * Delimiter detection heuristic (PRD §7.5 and OD-05).
 * Detects whether an unquoted line clearly uses semicolons or tabs instead of commas.
 */
export function detectUnsupportedDelimiter(content: string): boolean {
  // Inspect the first line (up to newline), respecting quotes
  let inQuotes = false;
  let unquotedCommas = 0;
  let unquotedSemicolons = 0;
  let unquotedTabs = 0;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (char === "\n" || char === "\r") {
        if (unquotedCommas === 0 && (unquotedSemicolons > 0 || unquotedTabs > 0)) {
          return true;
        }
        // Check only the first non-empty line
        if (unquotedCommas > 0 || unquotedSemicolons > 0 || unquotedTabs > 0) {
          break;
        }
      } else if (char === ",") {
        unquotedCommas++;
      } else if (char === ";") {
        unquotedSemicolons++;
      } else if (char === "\t") {
        unquotedTabs++;
      }
    }
  }

  return unquotedCommas === 0 && (unquotedSemicolons > 0 || unquotedTabs > 0);
}

/**
 * Validates a CSV file buffer or string against all PRD §7 criteria.
 */
export function validateCsv(
  input: Buffer | string,
  options: {
    maxSizeBytes?: number;
    maxRows?: number;
    maxColumns?: number;
    maxFieldSizeBytes?: number;
  } = {}
): ValidationOutcome {
  const config = getConfig();
  const maxSizeBytes = options.maxSizeBytes ?? config.limits.maxUploadSizeBytes;
  const maxRows = options.maxRows ?? 100000;
  const maxColumns = options.maxColumns ?? config.limits.tempMaxColumns;
  const maxFieldSizeBytes = options.maxFieldSizeBytes ?? config.limits.tempMaxFieldSizeBytes;

  // 1. File size check
  const byteSize = Buffer.isBuffer(input) ? input.byteLength : Buffer.byteLength(input, "utf-8");
  if (byteSize === 0) {
    return {
      isValid: false,
      errorCode: "EMPTY_FILE",
      errorMessage: "The uploaded file is empty.",
    };
  }

  if (byteSize > maxSizeBytes) {
    return {
      isValid: false,
      errorCode: "FILE_TOO_LARGE",
      errorMessage: `File exceeds maximum allowed size limit of ${Math.round(maxSizeBytes / (1024 * 1024))} MB.`,
    };
  }

  const rawString = Buffer.isBuffer(input) ? input.toString("utf-8") : input;

  // 2. Unsupported delimiter heuristic check
  if (detectUnsupportedDelimiter(rawString)) {
    return {
      isValid: false,
      errorCode: "UNSUPPORTED_DELIMITER",
      errorMessage: "File format is not supported comma-separated CSV. Detected unsupported delimiter (semicolon or tab).",
    };
  }

  // 3. Parse CSV structure
  let parsed: ParseResult;
  try {
    parsed = parseCsv(input, {
      maxRows,
      maxColumns,
      maxFieldSizeBytes,
    });
  } catch (error) {
    if (error instanceof CsvParserError) {
      return {
        isValid: false,
        errorCode: error.code,
        errorMessage: error.message,
        details: {
          line: error.line,
          column: error.column,
        },
      };
    }
    return {
      isValid: false,
      errorCode: "MALFORMED_CSV",
      errorMessage: "CSV structure or quoting is malformed.",
    };
  }

  const { headers, rows, hasBom } = parsed;

  // 4. Header presence and validation
  if (!headers || headers.length === 0 || headers.every((h) => h.trim() === "")) {
    return {
      isValid: false,
      errorCode: "HEADER_MISSING",
      errorMessage: "Header row is absent in the CSV file.",
    };
  }

  // Blank header name check
  for (let i = 0; i < headers.length; i++) {
    if (headers[i].trim() === "") {
      return {
        isValid: false,
        errorCode: "HEADER_BLANK",
        errorMessage: `Header at column ${i + 1} is empty or contains only whitespace.`,
      };
    }
  }

  // Duplicate header name check (exact string comparison after BOM handling)
  const headerSet = new Set<string>();
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (headerSet.has(h)) {
      return {
        isValid: false,
        errorCode: "HEADER_DUPLICATE",
        errorMessage: `Duplicate header '${h}' found. Header names must be unique.`,
      };
    }
    headerSet.add(h);
  }

  // 5. Data rows presence
  if (rows.length === 0) {
    return {
      isValid: false,
      errorCode: "NO_DATA_ROWS",
      errorMessage: "The file contains a header row but no data rows.",
    };
  }

  // 6. Row width check & blank row counting
  let ignoredBlankRowCount = 0;
  const expectedColCount = headers.length;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];

    // Single empty field in row could be a blank line in CSV
    if (row.length === 1 && row[0].trim() === "" && expectedColCount > 1) {
      ignoredBlankRowCount++;
      // Expand to match expected header width for uniform downstream processing
      rows[r] = new Array(expectedColCount).fill("");
      continue;
    }

    if (row.length !== expectedColCount) {
      return {
        isValid: false,
        errorCode: "INVALID_ROW_WIDTH",
        errorMessage: `Row ${r + 2} has ${row.length} fields, expected ${expectedColCount} matching header count.`,
        details: {
          rowNumber: r + 2,
          actualFields: row.length,
          expectedFields: expectedColCount,
        },
      };
    }

    if (isFullyBlankRow(row)) {
      ignoredBlankRowCount++;
    }
  }

  return {
    isValid: true,
    headers,
    rows,
    rowCount: rows.length,
    columnCount: expectedColCount,
    hasBom,
    ignoredBlankRowCount,
  };
}
