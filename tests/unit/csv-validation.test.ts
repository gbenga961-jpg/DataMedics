/**
 * Technical Acceptance Suite J02 — CSV Upload Validation (PRD §7.9)
 * Test Cases: CV-001 through CV-017
 */

import { describe, it, expect } from "vitest";
import { validateCsv } from "@/engine/csv/validator";

describe("Suite J02 — CSV Validation Acceptance Tests (CV-001 - CV-017)", () => {
  it("CV-001: Valid comma-separated UTF-8 CSV accepted", () => {
    const csv = "id,name,amount\n1,Alice,100\n2,Bob,200\n";
    const result = validateCsv(csv);
    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.headers).toEqual(["id", "name", "amount"]);
      expect(result.rowCount).toBe(2);
      expect(result.columnCount).toBe(3);
      expect(result.hasBom).toBe(false);
    }
  });

  it("CV-002: Valid UTF-8 BOM CSV accepted", () => {
    const bomCsv = "\uFEFFid,name\n1,Alice\n2,Bob";
    const result = validateCsv(bomCsv);
    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.headers).toEqual(["id", "name"]);
      expect(result.hasBom).toBe(true);
      expect(result.rowCount).toBe(2);
    }
  });

  it("CV-003: Invalid UTF-8 rejected", () => {
    // 0xFF 0xFE is UTF-16 LE, invalid UTF-8 byte sequence
    const invalidUtf8 = Buffer.from([0xff, 0xfe, 0x69, 0x00, 0x64, 0x00]);
    const result = validateCsv(invalidUtf8);
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errorCode).toBe("UNSUPPORTED_ENCODING");
    }
  });

  it("CV-004: Zero-byte file rejected", () => {
    const empty = Buffer.alloc(0);
    const result = validateCsv(empty);
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errorCode).toBe("EMPTY_FILE");
    }
  });

  it("CV-005: Missing header rejected", () => {
    // Empty text after trimming
    const result = validateCsv("\n\n");
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(["EMPTY_FILE", "HEADER_MISSING"]).toContain(result.errorCode);
    }
  });

  it("CV-006: Blank header rejected", () => {
    const blankHeader = "id,,price\n1,Widget,10.00";
    const result = validateCsv(blankHeader);
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errorCode).toBe("HEADER_BLANK");
    }
  });

  it("CV-007: Duplicate header rejected", () => {
    const duplicateHeader = "id,name,id\n1,Alice,2";
    const result = validateCsv(duplicateHeader);
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errorCode).toBe("HEADER_DUPLICATE");
    }
  });

  it("CV-008: Header-only file rejected", () => {
    const headerOnly = "id,name,price\n";
    const result = validateCsv(headerOnly);
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errorCode).toBe("NO_DATA_ROWS");
    }
  });

  it("CV-009: Uneven row width rejected", () => {
    const uneven = "id,name,price\n1,Apple,1.00\n2,Banana";
    const result = validateCsv(uneven);
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errorCode).toBe("INVALID_ROW_WIDTH");
    }
  });

  it("CV-010: Malformed quoted field rejected", () => {
    const malformed = 'id,name\n1,"Unclosed quote';
    const result = validateCsv(malformed);
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errorCode).toBe("MALFORMED_CSV");
    }
  });

  it("CV-011: Quoted comma parsed correctly", () => {
    const quotedComma = 'id,address\n1,"Springfield, IL"';
    const result = validateCsv(quotedComma);
    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.rows[0][1]).toBe("Springfield, IL");
    }
  });

  it("CV-012: Escaped quote parsed correctly", () => {
    const escapedQuote = 'id,quote\n1,"He said ""Data Medics""."';
    const result = validateCsv(escapedQuote);
    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.rows[0][1]).toBe('He said "Data Medics".');
    }
  });

  it("CV-013: Quoted newline parsed correctly", () => {
    const quotedNewline = 'id,multiline\n1,"Line 1\nLine 2"';
    const result = validateCsv(quotedNewline);
    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.rows[0][1]).toBe("Line 1\nLine 2");
      expect(result.rowCount).toBe(1); // One logical row
    }
  });

  it("CV-014: Whitespace-only cells accepted for analysis", () => {
    const whitespaceCells = "id,name\n1,   \n2,Bob";
    const result = validateCsv(whitespaceCells);
    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.rows[0][1]).toBe("   ");
    }
  });

  it("CV-015: Fully blank rows accepted and counted as ignored", () => {
    const withBlankRow = "id,name\n1,Alice\n  ,  \n2,Bob\n";
    const result = validateCsv(withBlankRow);
    expect(result.isValid).toBe(true);
    if (result.isValid) {
      expect(result.rowCount).toBe(3);
      expect(result.ignoredBlankRowCount).toBe(1);
    }
  });

  it("CV-016: File-size boundary enforced", () => {
    const content = "id,name\n1,Alice\n";
    // Enforce with a tiny 10-byte limit
    const result = validateCsv(content, { maxSizeBytes: 10 });
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errorCode).toBe("FILE_TOO_LARGE");
    }
  });

  it("CV-017: Data-row boundary enforced", () => {
    const content = "id,name\n1,A\n2,B\n3,C\n4,D\n5,E\n";
    // Limit to 3 data rows
    const result = validateCsv(content, { maxRows: 3 });
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errorCode).toBe("ROW_LIMIT_EXCEEDED");
    }
  });

  it("Rejects unsupported delimiter (semicolon or tab) with UNSUPPORTED_DELIMITER", () => {
    const semicolonSeparated = "id;name;price\n1;Widget;10.00\n2;Gadget;20.00";
    const result = validateCsv(semicolonSeparated);
    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.errorCode).toBe("UNSUPPORTED_DELIMITER");
    }

    // But allows semicolons inside quotes in valid CSV!
    const validWithQuotedSemicolon = 'id,notes\n1,"Part A; Part B"\n2,"Item; other"';
    const validResult = validateCsv(validWithQuotedSemicolon);
    expect(validResult.isValid).toBe(true);
  });
});
