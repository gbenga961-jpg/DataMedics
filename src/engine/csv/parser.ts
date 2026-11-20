/**
 * RFC 4180-Compliant CSV State-Machine Parser
 * Handles:
 * - Valid UTF-8 validation and BOM removal
 * - Quoted fields with escaped quotes ("")
 * - Quoted commas and quoted newlines (\r\n, \n, \r)
 * - Bounded memory, row limits, column limits, and field size limits
 * - Stable syntax error reporting
 */

export interface ParserOptions {
  maxRows?: number;
  maxColumns?: number;
  maxFieldSizeBytes?: number;
}

export interface ParseResult {
  headers: string[];
  rows: string[][];
  totalLogicalRows: number;
  hasBom: boolean;
  rawRowCount: number;
}

export class CsvParserError extends Error {
  public readonly code: string;
  public readonly line?: number;
  public readonly column?: number;

  constructor(code: string, message: string, line?: number, column?: number) {
    super(message);
    this.name = "CsvParserError";
    this.code = code;
    this.line = line;
    this.column = column;
  }
}

/**
 * Validates whether a buffer is valid UTF-8.
 */
export function isValidUtf8(buffer: Buffer): boolean {
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    decoder.decode(buffer);
    return true;
  } catch {
    return false;
  }
}

/**
 * Strips UTF-8 BOM if present.
 */
export function stripBom(content: string): { text: string; hadBom: boolean } {
  if (content.charCodeAt(0) === 0xfeff) {
    return { text: content.slice(1), hadBom: true };
  }
  return { text: content, hadBom: false };
}

/**
 * State machine states for RFC 4180 parser.
 */
enum State {
  START_OF_FIELD,
  UNQUOTED_FIELD,
  QUOTED_FIELD,
  QUOTE_IN_QUOTED_FIELD,
}

/**
 * Parses CSV content according to RFC 4180 with safety bounds.
 */
export function parseCsv(
  input: string | Buffer,
  options: ParserOptions = {}
): ParseResult {
  let content: string;
  let hasBom = false;

  if (Buffer.isBuffer(input)) {
    if (!isValidUtf8(input)) {
      throw new CsvParserError("UNSUPPORTED_ENCODING", "The file is not valid UTF-8.");
    }
    const stripped = stripBom(input.toString("utf-8"));
    content = stripped.text;
    hasBom = stripped.hadBom;
  } else {
    const stripped = stripBom(input);
    content = stripped.text;
    hasBom = stripped.hadBom;
  }

  if (content.length === 0) {
    throw new CsvParserError("EMPTY_FILE", "The file is empty.");
  }

  const maxRows = options.maxRows ?? 100000;
  const maxColumns = options.maxColumns ?? 1000;
  const maxFieldSizeBytes = options.maxFieldSizeBytes ?? 65536; // 64KB default bound

  const records: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let state = State.START_OF_FIELD;

  let lineNum = 1;
  let charNum = 0;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    charNum++;

    if (char === "\n") {
      lineNum++;
      charNum = 0;
    }

    switch (state) {
      case State.START_OF_FIELD:
        if (char === '"') {
          state = State.QUOTED_FIELD;
        } else if (char === ",") {
          currentRow.push("");
          checkFieldLimits(currentField, maxFieldSizeBytes, lineNum, charNum);
        } else if (char === "\r") {
          // Check if followed by \n
          if (content[i + 1] === "\n") {
            i++;
          }
          currentRow.push("");
          records.push(currentRow);
          currentRow = [];
          checkRowLimit(records.length, maxRows);
        } else if (char === "\n") {
          currentRow.push("");
          records.push(currentRow);
          currentRow = [];
          checkRowLimit(records.length, maxRows);
        } else {
          currentField += char;
          state = State.UNQUOTED_FIELD;
        }
        break;

      case State.UNQUOTED_FIELD:
        if (char === ",") {
          checkFieldLimits(currentField, maxFieldSizeBytes, lineNum, charNum);
          currentRow.push(currentField);
          currentField = "";
          checkColumnLimit(currentRow.length, maxColumns, lineNum);
          state = State.START_OF_FIELD;
        } else if (char === "\r") {
          if (content[i + 1] === "\n") {
            i++;
          }
          checkFieldLimits(currentField, maxFieldSizeBytes, lineNum, charNum);
          currentRow.push(currentField);
          currentField = "";
          records.push(currentRow);
          currentRow = [];
          checkRowLimit(records.length, maxRows);
          state = State.START_OF_FIELD;
        } else if (char === "\n") {
          checkFieldLimits(currentField, maxFieldSizeBytes, lineNum, charNum);
          currentRow.push(currentField);
          currentField = "";
          records.push(currentRow);
          currentRow = [];
          checkRowLimit(records.length, maxRows);
          state = State.START_OF_FIELD;
        } else if (char === '"') {
          // Unexpected quote in unquoted field
          throw new CsvParserError(
            "MALFORMED_CSV",
            `Unexpected quote character in unquoted field at line ${lineNum}, character ${charNum}.`,
            lineNum,
            charNum
          );
        } else {
          currentField += char;
        }
        break;

      case State.QUOTED_FIELD:
        if (char === '"') {
          state = State.QUOTE_IN_QUOTED_FIELD;
        } else {
          currentField += char;
        }
        break;

      case State.QUOTE_IN_QUOTED_FIELD:
        if (char === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          state = State.QUOTED_FIELD;
        } else if (char === ",") {
          checkFieldLimits(currentField, maxFieldSizeBytes, lineNum, charNum);
          currentRow.push(currentField);
          currentField = "";
          checkColumnLimit(currentRow.length, maxColumns, lineNum);
          state = State.START_OF_FIELD;
        } else if (char === "\r") {
          if (content[i + 1] === "\n") {
            i++;
          }
          checkFieldLimits(currentField, maxFieldSizeBytes, lineNum, charNum);
          currentRow.push(currentField);
          currentField = "";
          records.push(currentRow);
          currentRow = [];
          checkRowLimit(records.length, maxRows);
          state = State.START_OF_FIELD;
        } else if (char === "\n") {
          checkFieldLimits(currentField, maxFieldSizeBytes, lineNum, charNum);
          currentRow.push(currentField);
          currentField = "";
          records.push(currentRow);
          currentRow = [];
          checkRowLimit(records.length, maxRows);
          state = State.START_OF_FIELD;
        } else {
          // Characters immediately after closing quote without delimiter
          throw new CsvParserError(
            "MALFORMED_CSV",
            `Invalid character '${char}' following closing quote at line ${lineNum}, character ${charNum}.`,
            lineNum,
            charNum
          );
        }
        break;
    }
  }

  // Handle end of file
  if (state === State.QUOTED_FIELD) {
    throw new CsvParserError(
      "MALFORMED_CSV",
      `Unclosed quoted field at end of file.`,
      lineNum,
      charNum
    );
  }

  if (state === State.QUOTE_IN_QUOTED_FIELD || state === State.UNQUOTED_FIELD) {
    checkFieldLimits(currentField, maxFieldSizeBytes, lineNum, charNum);
    currentRow.push(currentField);
    records.push(currentRow);
  } else if (state === State.START_OF_FIELD && currentRow.length > 0) {
    currentRow.push("");
    records.push(currentRow);
  }

  // Handle trailing single empty record if produced by trailing newline
  if (
    records.length > 1 &&
    records[records.length - 1].length === 1 &&
    records[records.length - 1][0] === "" &&
    (content.endsWith("\n") || content.endsWith("\r"))
  ) {
    records.pop();
  }

  if (records.length === 0) {
    throw new CsvParserError("EMPTY_FILE", "The file contains no records.");
  }

  const headers = records[0];
  const dataRows = records.slice(1);

  return {
    headers,
    rows: dataRows,
    totalLogicalRows: dataRows.length,
    hasBom,
    rawRowCount: records.length,
  };
}

function checkFieldLimits(field: string, maxBytes: number, line: number, char: number): void {
  const bytes = Buffer.byteLength(field, "utf-8");
  if (bytes > maxBytes) {
    throw new CsvParserError(
      "FIELD_SIZE_EXCEEDED",
      `Field at line ${line} exceeds maximum size limit of ${maxBytes} bytes.`,
      line,
      char
    );
  }
}

function checkColumnLimit(colCount: number, maxColumns: number, line: number): void {
  if (colCount > maxColumns) {
    throw new CsvParserError(
      "COLUMN_LIMIT_EXCEEDED",
      `Row at line ${line} exceeds maximum allowed columns (${maxColumns}).`,
      line
    );
  }
}

function checkRowLimit(rowCount: number, maxRows: number): void {
  // Logical rows count beyond header
  if (rowCount - 1 > maxRows) {
    throw new CsvParserError(
      "ROW_LIMIT_EXCEEDED",
      `CSV data rows exceed maximum configured limit of ${maxRows} rows.`
    );
  }
}
