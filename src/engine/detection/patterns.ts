/**
 * Versioned Supported Pattern Catalogue (PRD §8.3, J03)
 * Catalogue Version: 1.0.0
 * 
 * Rules:
 * - Unambiguous date patterns only (e.g., YYYY-MM-DD, DD-MMM-YYYY).
 * - Ambiguous dates (e.g., MM/DD/YYYY vs DD/MM/YYYY) are flagged as AMBIGUOUS_DATE.
 * - Standard numeric patterns without ambiguous regional grouping.
 * - Explicit boolean pairs (true/false, yes/no, 1/0).
 */

export const PATTERN_CATALOGUE_VERSION = "1.0.0";

export enum PatternCategory {
  DATE = "DATE",
  NUMERIC = "NUMERIC",
  BOOLEAN = "BOOLEAN",
}

export interface PatternDefinition {
  id: string;
  category: PatternCategory;
  name: string;
  isAmbiguous?: boolean;
  match: (value: string) => boolean;
}

// 1. Dates: Unambiguous ISO 8601 (YYYY-MM-DD)
const ISO_DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Unambiguous Month Name date: DD-Mon-YYYY (e.g. 15-Jan-2026, 15-January-2026)
const MONTH_NAME_DATE_REGEX = /^(0?[1-9]|[12]\d|3[01])-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*-(\d{4})$/i;

// Ambiguous slashed dates (e.g. 03/04/2026 or 11/12/2026)
const SLASH_DATE_REGEX = /^(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|[12]\d|3[01])\/\d{4}$/;

// 2. Numbers: Standard decimal notation (e.g., 1234.56, -42, +10.5)
const STANDARD_DECIMAL_REGEX = /^[+-]?(0|[1-9]\d*)(\.\d+)?$/;

// Standard integer notation
const STANDARD_INTEGER_REGEX = /^[+-]?(0|[1-9]\d*)$/;

// Standard grouped decimal with comma thousands and dot decimal: 1,234.56
const COMMA_GROUPED_DECIMAL_REGEX = /^[+-]?[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/;

// Ambiguous numeric format: e.g. 1.234 or 1,234 without clear decimal portion
const AMBIGUOUS_SEPARATOR_REGEX = /^[+-]?[1-9]\d{0,2}[.,]\d{3}$/;

// 3. Booleans: Explicit boolean pairs
const BOOLEAN_TRUE_FALSE = /^(true|false)$/i;
const BOOLEAN_YES_NO = /^(yes|no)$/i;
const BOOLEAN_BINARY = /^[01]$/;

export const SUPPORTED_PATTERNS: PatternDefinition[] = [
  {
    id: "DATE_ISO_8601",
    category: PatternCategory.DATE,
    name: "ISO 8601 Date (YYYY-MM-DD)",
    match: (v) => ISO_DATE_REGEX.test(v.trim()),
  },
  {
    id: "DATE_DD_MON_YYYY",
    category: PatternCategory.DATE,
    name: "Day Month Name Year (DD-MMM-YYYY)",
    match: (v) => MONTH_NAME_DATE_REGEX.test(v.trim()),
  },
  {
    id: "DATE_AMBIGUOUS_SLASH",
    category: PatternCategory.DATE,
    name: "Ambiguous Slashed Date (DD/MM/YYYY or MM/DD/YYYY)",
    isAmbiguous: true,
    match: (v) => SLASH_DATE_REGEX.test(v.trim()),
  },
  {
    id: "NUMERIC_STANDARD_DECIMAL",
    category: PatternCategory.NUMERIC,
    name: "Standard Decimal",
    match: (v) => STANDARD_DECIMAL_REGEX.test(v.trim()) && !AMBIGUOUS_SEPARATOR_REGEX.test(v.trim()),
  },
  {
    id: "NUMERIC_COMMA_GROUPED",
    category: PatternCategory.NUMERIC,
    name: "Comma Thousands Separator Decimal",
    match: (v) => COMMA_GROUPED_DECIMAL_REGEX.test(v.trim()) && !AMBIGUOUS_SEPARATOR_REGEX.test(v.trim()),
  },
  {
    id: "NUMERIC_AMBIGUOUS_SEPARATOR",
    category: PatternCategory.NUMERIC,
    name: "Ambiguous Numeric Separator",
    isAmbiguous: true,
    match: (v) => AMBIGUOUS_SEPARATOR_REGEX.test(v.trim()),
  },
  {
    id: "BOOLEAN_TRUE_FALSE",
    category: PatternCategory.BOOLEAN,
    name: "Boolean True/False",
    match: (v) => BOOLEAN_TRUE_FALSE.test(v.trim()),
  },
  {
    id: "BOOLEAN_YES_NO",
    category: PatternCategory.BOOLEAN,
    name: "Boolean Yes/No",
    match: (v) => BOOLEAN_YES_NO.test(v.trim()),
  },
  {
    id: "BOOLEAN_BINARY_0_1",
    category: PatternCategory.BOOLEAN,
    name: "Boolean 1/0",
    match: (v) => BOOLEAN_BINARY.test(v.trim()),
  },
];
