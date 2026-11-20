# DATAMEDICS
# PRODUCT REQUIREMENTS DOCUMENT (PRD)

**Document version:** 1.5 — Final Quality-Reviewed Version 1 Specification  
**Supersedes:** DataMedics PRD v1.3 and approved amendments J01–J06  
**Document status:** Final quality-reviewed pre-build PRD baseline; implementation decisions remain gated as stated in Section 27  
**Product:** DataMedics  
**Application type:** Web-based CSV data-quality analysis and controlled-cleaning application  
**Approved stack:** Next.js, TypeScript, Prisma, PostgreSQL, BullMQ, Redis, private object storage  
**Scope:** Version 1 only

---

## Document control

### Purpose

This document is the single consolidated specification for DataMedics Version 1. It incorporates the original PRD v1.3, approved technical amendments J01–J06, and the approved product, architecture, database, functional, security, reliability, performance and testing reviews.

The amendments are integrated into the relevant sections. They are not separate competing specifications.

### Status and interpretation

- Requirements explicitly described as **must** are mandatory for the Version 1 implementation.
- **Default** values are initial operating settings and must be configurable server-side where specified.
- **Open decision** identifies a matter that remains unresolved and must not be silently assumed during implementation.
- **Pre-launch requirement** identifies a decision or verification that must be completed before production release.
- Architecture, schema and migration descriptions in this document are specifications. They do not mean code, migrations, infrastructure or deployment have already been created.
- Acceptance criteria are release conditions. They must not be described as passed until they have actually been executed and evidenced.

### Source and change history

| Version / item | Status | Treatment in this document |
|---|---|---|
| Original PRD v1.3 | Approved baseline | Preserved as the product and functional foundation |
| J01 — Complete Prisma Database Model | Approved with amendments | Integrated into Sections 15–17 |
| J02 — CSV Validation Behaviour | Approved as an amendment | Integrated into Sections 6–7 and 19 |
| J03 — Inconsistent-Format Detection | Approved | Integrated into Section 8 |
| J04 — CSV Formula Injection and Export Safety | Approved | Integrated into Sections 12–13 and 18 |
| J05 — Queue Reliability and Idempotency | Approved | Integrated into Sections 16–17 and 20 |
| J06 — Failed-Analysis File Expiry | Approved | Integrated into Section 21 |
| Stages 1–3 architecture and PRD reviews | Approved | Integrated throughout the relevant sections |
| Stage 3F open-decision review | Approved | Integrated into Section 27 |
| Final PRD quality review | Completed | Clarifications and implementation gates integrated into Sections 7, 13, 15, 16, 21 and 27; final sign-off recorded in Section 31 |

---

# 1. Product summary

## 1.1 Product overview

DataMedics is a web-based data-quality analysis and controlled CSV-cleaning application designed for small business owners, e-commerce operators, retail businesses and reporting staff.

Users upload CSV files. DataMedics validates the files, analyses their contents using deterministic rules, identifies supported data-quality issues and presents an understandable report.

Users can then select supported cleaning operations, confirm the changes, generate a separate cleaned CSV, preview the result and download a spreadsheet-safe representation.

DataMedics must preserve the original uploaded file. It must never silently overwrite or modify the original data.

## 1.2 Product vision

To help small businesses and reporting teams improve the quality of their data by making data inspection, issue identification and controlled cleaning simple and accessible.

## 1.3 Value proposition

DataMedics enables users to:

- Upload supported CSV data securely.
- Identify common data-quality problems.
- Understand affected columns and issue counts.
- Review practical recommendations.
- Choose which supported cleaning operations to perform.
- Generate a separate cleaned CSV.
- Preview the cleaned data and its remaining issues.
- Download the resulting CSV.

The product reduces the manual effort involved in inspecting and cleaning spreadsheet data while keeping the user in control of data changes.

## 1.4 Version 1 positioning

Version 1 is a CSV data-quality analysis and controlled-cleaning product. It is not a complete business intelligence platform, spreadsheet editor or advanced analytics suite.

---

# 2. Problem statement

Businesses regularly use sales, inventory, customer, order and operational data stored in spreadsheets and CSV files. These files may contain empty cells, duplicate records, inconsistent formats, unnecessary whitespace and completely blank rows.

Poor-quality data can affect reporting accuracy, calculations, inventory records and business decisions. Small businesses may not have dedicated data analysts or specialised data-quality tools, so manual inspection becomes time-consuming and error-prone.

DataMedics provides a controlled workflow to validate a CSV, identify supported issues, explain findings and create a separate cleaned copy using operations selected by the user.

## 2.1 Problems addressed

- Missing or whitespace-only values.
- Exact duplicate data rows.
- Supported inconsistent date, numeric or boolean-like formats.
- Unnecessary leading and trailing whitespace.
- Difficulty understanding the impact of cleaning.
- Risk of accidentally changing the original file.

## 2.2 Why the problem matters

Poor-quality data can affect sales reporting, inventory management, revenue calculations, customer records, operational performance and management decisions. DataMedics helps users identify and address supported issues before using data for further reporting or analysis.

---

# 3. Product goals and non-goals

## 3.1 Primary goals

1. Securely accept supported CSV files.
2. Validate uploaded CSV structure and operating limits.
3. Detect the four supported data-quality categories.
4. Generate understandable data-quality reports.
5. Show affected columns, counts, explanations and recommendations.
6. Let users select supported cleaning operations.
7. Generate a separate cleaned CSV.
8. Allow users to preview and examine cleaned data.
9. Allow users to download a spreadsheet-safe CSV representation.
10. Preserve the original uploaded file throughout analysis and cleaning.
11. Retain accessible reports and summaries according to policy.
12. Provide a simple, responsive user experience.

## 3.2 Secondary goals

- Reduce time spent manually inspecting data.
- Help non-technical users understand data-quality findings.
- Encourage safer data-management practices.
- Establish a reliable foundation for future analytical capabilities.

## 3.3 Version 1 non-goals

The following are explicitly outside Version 1:

- XLSX or other spreadsheet-file uploads.
- Google Sheets integration.
- AI chatbot or conversational data assistant.
- AI-based automatic data correction.
- Automatic filling or guessing of missing values.
- Automatic normalisation of ambiguous date or numeric formats.
- Manual spreadsheet editing inside the application.
- Advanced business intelligence dashboards.
- Advanced sales and inventory analytics.
- Predictive analytics.
- Advanced statistical diagnosis and profiling.
- Business-specific calculations such as profit forecasting.
- Payment integration.
- User-defined arbitrary transformation scripts.
- Exporting a separate downloadable analytical report, unless separately approved in a future scope change.

Version 1 uses deterministic, testable processing rules. It does not silently change business data.

---

# 4. Target users and personas

## 4.1 Small business owner

A business owner who manages sales, inventory or customer records using spreadsheets.

**Needs:** simple upload, clear data-quality findings, understandable recommendations, a cleaned CSV and confidence that the original remains unchanged.

## 4.2 Reporting staff

An employee responsible for preparing reports from files received from different departments.

**Needs:** faster data-quality checks, accurate issue counts, practical cleaning controls and reliable output.

## 4.3 E-commerce or retail operator

A person who works with product, sales, order and inventory records.

**Needs:** reliable CSV inspection, column-level issue identification, controlled cleaning and downloadable data.

## 4.4 Access model

- Visitors may access the public landing page.
- Users must register and authenticate before uploading files or accessing private resources.
- Each user may access only their own uploads, reports, cleaning runs, previews and generated files.
- Every private API operation must independently verify ownership server-side.

---

# 5. Version 1 product scope

Version 1 contains eight main capabilities.

## 5.1 Authentication

Users can create an account, sign in, sign out and access a private dashboard. Authentication provider, email verification and password recovery remain open decisions. If the application manages passwords directly, password hashes must be stored securely; plain-text passwords are prohibited.

## 5.2 User dashboard

The dashboard provides:

- Welcome message.
- New CSV upload action.
- Previous uploads and analysis reports.
- File names and upload dates.
- Analysis and cleaning statuses.
- Links to completed reports.
- Links to available cleaned-file previews and downloads.
- Clear expired-file and failure messages.

Statuses shown include queued, processing, completed and failed for both analysis and cleaning.

## 5.3 CSV upload and validation

Users can upload comma-separated `.csv` files subject to the validation rules in Section 7. Accepted originals are stored in private object storage and analysed asynchronously.

## 5.4 Data-quality analysis

The system detects:

1. Missing values.
2. Exact duplicate rows.
3. Supported inconsistent formats.
4. Unnecessary whitespace.

The analysis engine is deterministic and does not modify the original file.

## 5.5 Data-quality report

The report includes file information, analysis date, row and column counts, issue categories, affected columns, issue counts, explanations, recommendations and detection status.

## 5.6 Controlled cleaned CSV generation

Users review a completed report, select one or more supported cleaning operations, review the explanation and confirm before processing. The system creates a separate output. The original remains unchanged.

## 5.7 Cleaned data preview and examination

Users can examine the cleaned output in a read-only, paginated preview. The preview shows the headers, rows, cleaning summary and remaining data-quality findings.

## 5.8 Cleaned CSV download

Users can download the spreadsheet-safe CSV output after successful cleaning and validation. Download access is authenticated, ownership-checked and time-limited.

---

# 6. Functional requirements

## 6.1 Authentication and access

- FR-01: The system must allow users to create accounts.
- FR-02: The system must allow registered users to authenticate.
- FR-03: The system must support sign-out.
- FR-04: Private pages and API operations must require authentication.
- FR-05: Every private resource access must verify ownership server-side.
- FR-06: Passwords must never be stored in plain text if local password authentication is used.
- FR-07: Authentication and authorisation failures must not disclose whether another user's private resource exists.

## 6.2 Dashboard

- FR-08: Display a welcome message and upload action.
- FR-09: Display the authenticated user's previous uploads and reports.
- FR-10: Display file names and upload dates.
- FR-11: Display analysis status.
- FR-12: Display cleaning status.
- FR-13: Link to completed analysis reports.
- FR-14: Link to available cleaned-file previews and downloads.
- FR-15: Display expiry and failure information clearly.

## 6.3 Upload and validation

- FR-16: Accept only supported `.csv` uploads.
- FR-17: Validate the file on the server.
- FR-18: Enforce file-size, row and configured parser limits.
- FR-19: Store accepted originals in private object storage.
- FR-20: Create an uploaded-file database record.
- FR-21: Create an analysis report record for an accepted analysis request.
- FR-22: Create a persistent processing-job record.
- FR-23: Queue analysis asynchronously.
- FR-24: Reject invalid files with a stable error code and understandable message.
- FR-25: Never modify the original file during upload or analysis.

## 6.4 Analysis and reporting

- FR-26: Detect missing values.
- FR-27: Detect exact duplicate rows.
- FR-28: Detect supported inconsistent formats conservatively.
- FR-29: Detect unnecessary leading and trailing whitespace.
- FR-30: Calculate and persist issue counts.
- FR-31: Identify affected columns.
- FR-32: Store explanations and recommendations.
- FR-33: Store detection status and relevant pattern metadata.
- FR-34: Preserve original report findings after cleaning.
- FR-35: Make reports accessible according to the retention policy.

## 6.5 Cleaning

- FR-36: Permit a cleaning request only from an eligible completed report while its original file is available.
- FR-37: Display the three supported cleaning operations.
- FR-38: Apply the defined default selections.
- FR-39: Allow the user to select or deselect supported operations.
- FR-40: Explain each operation and its potential row-removal effect.
- FR-41: Require explicit confirmation before creating the cleaning job.
- FR-42: Require at least one operation to be selected.
- FR-43: Create a separate cleaning-run record.
- FR-44: Generate a separate output without overwriting the original.
- FR-45: Record operation counts and cleaning summary.
- FR-46: Re-run the four data-quality checks on the cleaned output.
- FR-47: Store post-cleaning findings separately from original findings.
- FR-48: Handle failures without presenting partial output as completed.

## 6.6 Preview

- FR-49: Permit preview of successfully generated cleaned files only.
- FR-50: Display original headers and cleaned rows.
- FR-51: Support pagination with a default page size of 50 data rows.
- FR-52: Display original and final row counts.
- FR-53: Display operation counts and cleaning summary.
- FR-54: Display remaining data-quality findings.
- FR-55: Render all CSV values as text, never as executable HTML or script.
- FR-56: Keep the preview read-only.
- FR-57: Do not expose storage keys or private storage locations.

## 6.7 Download

- FR-58: Permit download only after output validation and successful publication.
- FR-59: Verify ownership of the cleaning run and cleaned file.
- FR-60: Deliver the spreadsheet-safe CSV representation.
- FR-61: Preserve headers, column order and remaining record order.
- FR-62: Use valid CSV quoting and escaping.
- FR-63: Block access to expired or deleted files.
- FR-64: Never make private storage buckets public.

## 6.8 Retention and deletion

- FR-65: Apply the original-file retention rules in Section 21.
- FR-66: Apply the cleaned-file retention rules in Section 21.
- FR-67: Prevent deletion of files needed by active or retry-eligible jobs.
- FR-68: Record deletion only after storage confirms successful deletion.
- FR-69: Retry temporary deletion failures.
- FR-70: Preserve permitted report and summary metadata after source-file expiry.
- FR-71: Support user deletion of their own records and files, subject to safe deletion and applicable legal requirements.

---

# 7. CSV validation specification (J02)

## 7.1 Supported file and limits

Initial server-side defaults:

| Rule | Default |
|---|---|
| File extension | `.csv` only |
| File size | Maximum 25 MiB |
| Data rows | Maximum 100,000 |
| Encoding | UTF-8 |
| UTF-8 BOM | Accepted |
| Delimiter | Comma-separated CSV |
| Preview | 50 data rows per page |

Limits must be enforced server-side and must not be controlled by untrusted browser input.

The maximum column count and maximum individual field size remain open decisions and are **pre-build decisions for the CSV parser**. They must be selected before the parser is treated as implementation-complete. Until then, development may use temporary local test settings, but no unbounded parser behaviour is permitted and no temporary setting may be represented as an approved production limit.

## 7.2 Encoding and parsing

- Accept valid UTF-8.
- Accept and remove an initial UTF-8 byte-order mark for parsing.
- Reject invalid UTF-8.
- Correctly parse quoted commas, escaped quotation marks and line breaks inside quoted fields.
- Use a maintained TypeScript-compatible CSV parser.
- Do not split CSV records by naïvely splitting on newline or comma.
- Preserve parsed field values except where a specifically approved cleaning operation applies.

## 7.3 Required structure

A valid upload must contain:

- A non-empty file.
- A header row.
- At least one data row.
- Non-blank header names.
- Unique header names under the approved exact-comparison rule.
- Consistent field counts across data records.
- Well-formed CSV quoting.

The following must be rejected:

- Zero-byte file.
- Missing header.
- Blank header name.
- Duplicate header name.
- Header-only file with no data rows.
- Uneven row widths.
- Malformed quoting or malformed CSV structure.
- Invalid UTF-8.
- Unsupported delimiter or file format.
- File exceeding the configured size limit.
- File exceeding the configured row limit.

Fully blank data rows and whitespace-only cells are not upload-structure errors by themselves. They are handled by analysis rules.

## 7.4 Header treatment

- Remove an initial UTF-8 BOM before evaluating the first header.
- Compare header names exactly after BOM handling.
- Do not silently trim or normalise header names.
- Preserve original header text in generated output.
- Leading or trailing header whitespace warning behaviour remains an open decision; it must not be silently rewritten.

## 7.5 Delimiter policy

Version 1 is comma-separated CSV. Semicolon- or tab-delimited files are not supported as alternate delimiters. The validator should identify clearly recognised unsupported delimiters and reject them with `UNSUPPORTED_DELIMITER`, rather than silently parsing the file incorrectly.

The exact detection heuristic for identifying an unsupported delimiter must be documented and covered by tests before the CSV-validation milestone is accepted. It must avoid rejecting valid comma-separated files that contain semicolons or tabs inside quoted values. The parser must respect CSV quoting when evaluating delimiter evidence.

## 7.6 Whitespace and blank rows

- Whitespace-only cells are accepted and later counted as missing values during analysis.
- Fully blank data rows are accepted and counted as ignored rows during analysis.
- Fully blank rows are excluded from the main missing-value count and whitespace issue count.
- Upload validation must distinguish blank records from malformed records.

## 7.7 Validation sequence

The server-side sequence must be:

1. Authenticate user and establish upload ownership context.
2. Check extension and configured file-size limit.
3. Validate UTF-8 encoding and handle an initial BOM.
4. Parse CSV structure safely using bounded parser settings.
5. Validate header presence and header names.
6. Validate row widths and count logical parsed data records.
7. Apply delimiter, maximum-column and maximum-field-size checks.
8. Return a stable validation outcome.
9. Store and queue only accepted uploads.

The 100,000-row limit applies to logical parsed data records after the header, not physical newline characters. Fully blank data records still count toward this safety limit even though they are excluded from the main data-quality issue counts. This prevents blank records or quoted multiline values from bypassing resource limits.

No analysis job should be queued for a rejected upload.

## 7.8 Stable validation error codes

| Code | Meaning |
|---|---|
| `EMPTY_FILE` | File contains no content |
| `HEADER_MISSING` | Header row is absent |
| `HEADER_BLANK` | One or more header names are blank |
| `HEADER_DUPLICATE` | Duplicate header names found |
| `NO_DATA_ROWS` | Header exists but no data records exist |
| `INVALID_ROW_WIDTH` | Record field count differs from header |
| `MALFORMED_CSV` | CSV quoting or structure is invalid |
| `UNSUPPORTED_ENCODING` | File is not valid UTF-8 |
| `UNSUPPORTED_DELIMITER` | File is not supported comma-separated CSV |
| `FILE_TOO_LARGE` | File exceeds configured size limit |
| `ROW_LIMIT_EXCEEDED` | Data rows exceed configured maximum |

User-facing messages must explain the issue without exposing internal paths, stack traces or sensitive implementation details.

## 7.9 Validation acceptance tests

The validation suite must include at least the following cases:

- CV-001: Valid comma-separated UTF-8 CSV accepted.
- CV-002: Valid UTF-8 BOM CSV accepted.
- CV-003: Invalid UTF-8 rejected.
- CV-004: Zero-byte file rejected.
- CV-005: Missing header rejected.
- CV-006: Blank header rejected.
- CV-007: Duplicate header rejected.
- CV-008: Header-only file rejected.
- CV-009: Uneven row width rejected.
- CV-010: Malformed quoted field rejected.
- CV-011: Quoted comma parsed correctly.
- CV-012: Escaped quote parsed correctly.
- CV-013: Quoted newline parsed correctly.
- CV-014: Whitespace-only cells accepted for analysis.
- CV-015: Fully blank rows accepted and counted as ignored.
- CV-016: File-size boundary enforced.
- CV-017: Data-row boundary enforced.

Additional tests must cover unsupported delimiter detection, quoted semicolons/tabs, header whitespace, maximum columns and maximum field size when those open decisions are resolved.

---

# 8. Data-quality detection rules

The four original categories remain unchanged. Detection must be deterministic, conservative and testable. The analysis engine must not guess user intent or modify the original dataset.

## 8.1 Missing values

A data cell is missing when it is empty after CSV parsing or contains only whitespace.

The following values are not automatically missing:

- `0`
- `0.00`
- `N/A`
- `NA`
- `NULL`
- `null`
- `-`
- `unknown`
- `not provided`

These may have legitimate business meanings.

Rules:

- Exclude the header row.
- Exclude fully blank data rows from the main missing-value count.
- Record the number of fully blank rows ignored.
- Count each missing cell once.
- Report affected columns and counts.
- Do not fill missing values or delete rows merely because some cells are missing.

## 8.2 Exact duplicate rows

A row is an exact duplicate when all parsed data-column values match another row.

Rules:

- Exclude the header.
- Ignore fully blank rows.
- Compare parsed values consistently as strings.
- Do not trim whitespace before original analysis duplicate comparison.
- Do not change letter casing or normalise values before comparison.
- Do not infer duplicates from one field such as order ID, SKU or product name.
- If three identical records appear, report two duplicate occurrences.
- Where available, report duplicate group count separately from duplicate occurrences.

Original analysis does not delete or modify records.

## 8.3 Inconsistent formats (J03)

A column is eligible for supported-format assessment only when:

- At least 80% of its non-empty values match one supported pattern.
- At least two distinct non-empty values exist.

The system must not infer types from column names.

### Conservative pattern rules

- Recognise only explicitly supported date patterns.
- Do not guess ambiguous dates such as `03/04/2026` without an approved locale rule.
- Recognise documented numeric conventions only; do not guess regional thousands or decimal separators.
- Recognise explicit boolean-like pairs such as `true/false` and `yes/no` when the mapping is reliable.
- Do not automatically convert any values.
- Casing differences alone are not format inconsistencies.
- If confidence is insufficient, mark the result `NOT_ASSESSED`.
- If multiple competing patterns each appear dominant or the evidence is ambiguous, mark `NOT_ASSESSED` rather than selecting a winner.

The exact supported pattern catalogue must be versioned and tested. Only explicitly documented patterns may be classified. The 80% threshold is calculated as matching non-empty values divided by all non-empty values assessed in that column for the relevant format category; empty and whitespace-only values are excluded from this denominator. The implementation must use a documented rounding rule and must compare the unrounded ratio to the 80% threshold.

### Reporting

For each assessed column, store or report:

- Column identifier/name.
- Format category.
- Recognised pattern(s).
- Matching count.
- Non-matching count.
- Unclassified count.
- Total non-empty count.
- Match percentage.
- Assessment status.
- Detection rule/engine version.

### Format-detection acceptance tests

The suite must include FD-001 through FD-016 covering:

- 80% threshold boundary.
- Values below threshold.
- Minimum two distinct values.
- Single distinct value.
- Supported unambiguous date patterns.
- Ambiguous date values.
- Supported numeric patterns.
- Ambiguous numeric separators.
- Explicit boolean pairs.
- Mixed boolean representations.
- Competing dominant patterns.
- Casing-only variation.
- Empty values excluded from denominator.
- No type inference from column name.
- `NOT_ASSESSED` outcomes.
- Deterministic repeatability and metadata.

## 8.4 Unnecessary whitespace

Inspect data cells for leading or trailing spaces, tabs, line breaks and supported Unicode whitespace.

Rules:

- Do not flag spaces between words.
- Do not modify values during analysis.
- Exclude headers.
- Exclude fully blank rows.
- Whitespace-only cells count as missing values only; do not double-count them as whitespace issues.
- Count an affected cell once even if both leading and trailing whitespace are present.
- Report affected column and affected-cell count.

---

# 9. Controlled cleaning rules

## 9.1 Principles

Cleaning is user-controlled. The system must never assume every finding should be corrected. The original upload remains unchanged. Only the selected operations may change the generated copy.

## 9.2 Supported operations

Exactly three operations are supported in Version 1.

### Operation 1 — Trim leading and trailing whitespace

- Remove supported leading and trailing spaces.
- Remove supported leading and trailing tabs.
- Remove supported leading and trailing line breaks.
- Remove supported leading and trailing Unicode whitespace.
- Preserve spaces between words.
- Leave unaffected values unchanged.
- Convert a whitespace-only cell into an empty cell.
- Do not modify original column headers.

**Default:** selected. User may deselect.

### Operation 2 — Remove fully blank rows

Remove data rows where every data cell is empty or contains only whitespace after the selected trimming operation has run.

- Never remove the header.
- Never remove a row containing at least one non-empty value.
- Preserve remaining row order.
- Record number of rows removed.

**Default:** not selected. Explicit user selection required.

### Operation 3 — Remove exact duplicate rows

- Compare all data columns.
- Keep the first occurrence.
- Remove later exact matches.
- Preserve order of remaining rows.
- Do not remove rows based on a single shared field.
- Record the number of duplicate rows removed.

**Default:** not selected. Explicit user selection required.

## 9.3 Operation order

The engine must execute selected operations in this order:

1. Parse original CSV and preserve headers/column order.
2. Trim selected leading/trailing whitespace.
3. Remove fully blank rows if selected.
4. Remove exact duplicate rows if selected.
5. Generate canonical cleaned CSV.
6. Validate generated output.
7. Run the same four data-quality checks on the cleaned output.
8. Generate spreadsheet-safe download representation.
9. Validate and publish both required output objects.
10. Persist summary and remaining findings.

Because trimming runs before duplicate removal, rows that differ only by leading/trailing whitespace may become identical. If duplicate removal is selected, later occurrences may then be removed.

## 9.4 Unsupported cleaning operations

Version 1 must not:

- Fill missing prices, quantities, names or customer details.
- Insert zeros or averages.
- Delete rows simply because some cells are missing.
- Guess dates, currencies, decimal conventions or thousands separators.
- Automatically normalise ambiguous formats.
- Convert text casing.
- Modify identifiers, prices, quantities or business values outside the selected operations.
- Provide manual cell editing.
- Execute formulas or treat CSV contents as instructions.

Missing values and unsupported inconsistencies remain unchanged unless a future approved scope change adds explicit user-controlled operations.

## 9.5 Confirmation

Before creating a cleaning run, show:

- Selected operations.
- Explanation of each operation.
- Warning that row-removal operations remove records from the generated copy.
- Statement that the original upload remains unchanged.

At least one operation must be selected. User confirmation is mandatory.

## 9.6 Cleaning summary

Persist and display:

- Original row count.
- Final row count.
- Original column count.
- Number of cells trimmed.
- Fully blank rows removed.
- Duplicate rows removed.
- Operations selected and performed.
- Number of values protected for spreadsheet-safe export.
- Remaining missing values.
- Remaining duplicate rows.
- Remaining format findings.
- Remaining whitespace findings.

Clearly distinguish original findings, actual cleaning changes and post-cleaning findings. Do not claim that output is error-free when findings remain.

## 9.7 Multiple cleaning runs

Users may create multiple independent cleaning runs from the same report while the original file remains available.

Each run has its own identifier, idempotency context, selected operations, status, summary, output and expiry. A failed run must not invalidate a separate completed run.

---

# 10. Cleaned data preview

## 10.1 Read-only preview

The preview is read-only. It must not allow editing or modify the generated file.

Display:

- Cleaned filename.
- Original column headers and order.
- Cleaned data rows.
- Current page and total row count.
- Rows per page.
- Cleaning operations performed.
- Original and final row counts.
- Cleaning summary.
- Remaining data-quality findings.

## 10.2 Pagination and resource use

- Default page size: 50 data rows.
- Users can navigate between pages.
- Do not load the entire dataset into browser memory.
- Retrieve only the required preview range from the generated private object.
- Do not expose storage keys or private storage locations.

## 10.3 Preview safety

All values must be rendered as text. Uploaded values must not be interpreted as HTML, scripts or application instructions. Ownership and expiry checks apply to every preview request.

---

# 11. CSV output and download requirements

## 11.1 Canonical cleaned data

The canonical cleaned CSV is the deterministic result of the selected cleaning operations. It preserves legitimate source values except for the selected operations. It is not modified merely to make spreadsheet applications safer.

## 11.2 Spreadsheet-safe download representation (J04)

The downloadable representation must be generated separately from canonical cleaned data.

Uploaded CSV values are untrusted input. The system must never execute or evaluate formulas during analysis, cleaning, preview or export.

CSV quoting and escaping alone are not sufficient protection against spreadsheet formula injection.

The export-safety process must:

- Identify potentially dangerous formula-like values, including values beginning with `=`, `+`, `-` or `@`.
- Consider relevant leading whitespace and control characters that may precede formula-like content.
- Preserve confidently recognised legitimate numeric values, including negative numbers, where safe classification is reliable.
- Apply the approved neutralisation policy to suspicious text values.
- Record the number of values modified for export safety.
- Clearly disclose that potentially dangerous values were protected.
- Never modify the canonical cleaned data as a side effect of export protection.

The proposed neutralisation method is to prefix suspicious values with an apostrophe. This is a mitigation, not a universal guarantee across every spreadsheet product or import pathway. It must be tested against supported spreadsheet applications, including Microsoft Excel and LibreOffice. The exact implementation must be isolated in a dedicated export-safety module and documented. The module must operate on parsed cell values before CSV serialization, and the serializer must then apply normal CSV quoting and escaping. A value that is altered for spreadsheet safety must be counted once per affected cell in the exported dataset. The canonical cleaned data must remain unchanged.

## 11.3 Output validation and publication

The system must not publish a partial or unvalidated output.

Recommended sequence:

1. Generate canonical output to a temporary private object.
2. Validate its CSV structure, row/column counts and expected content.
3. Generate spreadsheet-safe representation.
4. Validate the safe representation.
5. Store both final objects privately.
6. Confirm object storage success.
7. Persist metadata and summary in PostgreSQL.
8. Mark the cleaning run completed.
9. Make preview and download available.

If any required step fails, the run must not appear completed. Temporary objects must be cleaned up safely. A retry must reuse or safely replace deterministic object keys rather than create duplicate published outputs.

## 11.4 CSV formatting and filename

- UTF-8 output.
- Consistent line endings.
- Correct quoting/escaping for commas, quotes and line breaks.
- Preserve original header row and column order.
- Preserve remaining record order.
- Do not add internal IDs or metadata columns.
- Use original filename as the basis for output name, with a cleaning timestamp.

Example: `monthly_sales_cleaned_20261101_153000.csv`.

## 11.5 Download security

Verify authenticated ownership of the user, cleaning run and cleaned file. Stream through an authenticated endpoint or use a short-lived signed URL. Never expose public buckets or permanent storage URLs. Block expired and deleted files.

## 11.6 Export-safety acceptance tests

The export test suite must include EX-AT-01 through EX-AT-14, covering dangerous prefixes, whitespace/control-character prefixes, legitimate negative numbers, quoted fields, unchanged canonical data, safe-output correctness, protection counts, user disclosure, Excel/LibreOffice behaviour, retries, malformed output and publication only after validation.

---

# 12. User journeys and interface requirements

## 12.1 Main journey

1. User visits public DataMedics landing page.
2. User registers or signs in.
3. User opens dashboard.
4. User uploads a CSV.
5. Server validates the file.
6. Accepted original is stored privately.
7. Analysis job is persisted and queued.
8. Worker analyses CSV.
9. Report and findings are saved.
10. User reviews findings and recommendations.
11. User selects cleaning operations.
12. Application explains operations and impact.
13. User confirms.
14. Cleaning worker generates and validates output.
15. User previews cleaned data and summary.
16. User reviews remaining findings and export-safety disclosure.
17. User downloads the spreadsheet-safe CSV.

## 12.2 Analysis failure journey

- Record safe failure code.
- Retry eligible temporary failures within the configured attempt limit.
- Mark permanent/exhausted failure as `FAILED`.
- Show understandable message.
- Do not create a successful report for failed analysis.
- Preserve safe failure metadata.
- Apply failed-analysis retention rules to the original file.
- Never present a partial result as completed.

## 12.3 Cleaning failure journey

- Record safe error code.
- Retry eligible temporary failures.
- Mark run failed when permanent or retries exhausted.
- Preserve original upload and original analysis report.
- Do not publish partial output.
- Ensure one failed run does not affect other runs.

## 12.4 User interface pages

### Public landing page

Explain what DataMedics does, supported problems, upload-to-download workflow and registration/sign-in.

### Dashboard

Show uploads, reports, statuses, expiry and available cleaned outputs.

### Analysis report page

Show file information, data summary, four issue categories, affected columns, counts, explanations, recommendations and cleaning action.

### Cleaning options page

Show exactly three operations, defaults, explanations, row-removal warning and confirmation.

### Cleaned preview page

Show table, pagination, cleaning summary, remaining findings, export-safety disclosure and download action.

## 12.5 Mobile and accessibility

The application must work on mobile phones and desktop computers. Tables may use horizontal scrolling where necessary. Provide clear labels, keyboard navigation, visible focus indicators and status communication that does not rely on colour alone. Detailed accessibility standard and browser/device matrix remain open decisions.

---

# 13. Technical architecture

## 13.1 Approved stack

| Layer | Technology |
|---|---|
| Web application | Next.js |
| Language | TypeScript |
| Relational database | PostgreSQL |
| ORM | Prisma |
| Background queue | BullMQ |
| Queue storage | Redis |
| File storage | Private object storage |
| CSV analysis/cleaning | Deterministic TypeScript modules |

The approved stack must not be replaced without an explicit architecture change.

## 13.2 Architectural principles

- PostgreSQL is the authoritative source for persisted application and job state.
- BullMQ/Redis delivers and executes background work; queue state alone does not establish business completion.
- CSV processing is deterministic and separated from UI concerns.
- Original and generated files are stored privately.
- Analysis and cleaning run asynchronously.
- Workers receive identifiers, not raw CSV payloads or credentials.
- Every private resource operation enforces ownership.
- Processing modules are independently testable.
- The browser does not perform full-file cleaning.

## 13.3 Application components

1. Next.js application and route handlers.
2. Authentication and authorisation layer.
3. Prisma database layer.
4. PostgreSQL.
5. Private object storage.
6. BullMQ and Redis.
7. Analysis worker.
8. Cleaning worker.
9. Expiry/deletion worker.
10. CSV parser/writer.
11. Detection modules.
12. Cleaning modules.
13. Export-safety module.
14. Logging and monitoring.

Analysis and cleaning may initially share worker process infrastructure if job types remain logically separate and independently tested.

## 13.4 Analysis workflow

1. Authenticate and validate upload.
2. Store accepted original in private storage.
3. Create upload, report and processing-job records in PostgreSQL.
4. Submit stable analysis job ID to BullMQ.
5. Worker loads authoritative DB record.
6. Worker verifies eligibility and source-file availability.
7. Parse CSV and run four detection modules.
8. Persist findings and report totals.
9. Mark report/job completed only after persistence succeeds.
10. Expose report to owner.

## 13.5 Cleaning workflow

1. Verify report and original-file ownership/eligibility.
2. Validate selected operations.
3. Validate request idempotency key.
4. Create cleaning-run record.
5. Submit stable queue job ID.
6. Worker claims eligible DB record.
7. Retrieve original file privately.
8. Apply selected operations in fixed order.
9. Generate canonical cleaned data.
10. Run post-cleaning detection.
11. Generate separate spreadsheet-safe export.
12. Validate both outputs.
13. Store both private objects.
14. Persist metadata, summary and findings.
15. Mark run completed.
16. Enable preview and download.

## 13.6 Proposed project structure

```text
datamedics/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   └── api/
│   ├── components/
│   │   ├── dashboard/
│   │   ├── upload/
│   │   ├── reports/
│   │   ├── cleaning/
│   │   └── shared/
│   ├── services/
│   │   ├── files/
│   │   ├── analysis/
│   │   ├── cleaning/
│   │   └── jobs/
│   ├── engine/
│   │   ├── csv/
│   │   ├── detection/
│   │   ├── cleaning/
│   │   └── export/
│   ├── workers/
│   │   ├── analysis.worker.ts
│   │   ├── cleaning.worker.ts
│   │   └── expiry.worker.ts
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── redis.ts
│   │   ├── queue.ts
│   │   ├── storage.ts
│   │   └── auth/
│   └── types/
└── tests/
    ├── unit/
    ├── integration/
    ├── acceptance/
    └── fixtures/
```

This is a proposed organisation, not a statement that these files already exist.

---

# 14. API requirements

The exact route-handler implementation may evolve, but responsibilities and security controls must remain. Request and response schemas, validation rules, authentication behaviour, stable error codes and rate/abuse controls must be documented during implementation. API examples in this section define responsibilities, not a claim that routes already exist.

## 14.1 Upload

- `POST /api/uploads` — validate and initiate upload, store privately, create records and queue analysis.
- `GET /api/uploads` — list authenticated user's uploads.
- `GET /api/uploads/[id]` — return metadata for one owned upload.

## 14.2 Reports and analysis

- `GET /api/reports` — list owned reports.
- `GET /api/reports/[reportId]` — return one owned report and findings.
- `GET /api/analysis-jobs/[jobId]` — return owned analysis status.

## 14.3 Cleaning

- `POST /api/reports/[reportId]/cleaning-runs` — validate selection/idempotency, create run and queue work.
- `GET /api/cleaning-runs/[cleaningRunId]` — return owned status and summary.
- `GET /api/cleaning-runs/[cleaningRunId]/preview` — return paginated preview.
- `GET /api/cleaned-files/[cleanedFileId]/download` — verify ownership and deliver safe export.
- `DELETE /api/cleaning-runs/[cleaningRunId]` — request deletion of owned cleaning result and associated output objects under safe deletion rules.

All private endpoints must verify authentication, ownership, state and expiry server-side. Do not rely on client-supplied user IDs or storage keys.

---

# 15. Database and Prisma data model (J01)

## 15.1 Design principles

The database has eight core models:

1. `User`
2. `UploadedFile`
3. `AnalysisReport`
4. `DataQualityIssue`
5. `ProcessingJob`
6. `CleaningRun`
7. `CleanedFile`
8. `CleaningResultIssue`

Keep these eight core models for Version 1. Do not add a ninth outbox or infrastructure model as part of the current approved baseline. Queue recovery uses reconciliation against existing records. A future architecture change may revisit this if evidence justifies it.

Prisma schema and SQL migrations must enforce referential integrity, uniqueness, indexes and database-level checks where Prisma schema declarations alone cannot express the required constraints.

## 15.2 User

Core fields:

- `id`
- `name`
- `email` (unique)
- `passwordHash` (nullable only if an external identity provider is used)
- `createdAt`
- `updatedAt`

Relations: uploaded files and cleaning runs.

`passwordHash` is required only when the application manages local passwords. Do not store provider passwords or credentials.

## 15.3 UploadedFile

Core fields:

- `id`
- `userId`
- `filename`
- `storageKey`
- `fileSizeBytes`
- `mimeType`
- `rowCount`
- `columnCount`
- `uploadStatus`
- `uploadedAt`
- `expiresAt`
- `deletionRequestedAt`
- `deletionStatus`
- `fileDeletedAt`
- `deletedAt`

Relations: owning user and associated analysis reports.

Storage references must remain private. Deletion state must distinguish not scheduled, pending, failed and completed outcomes. `fileDeletedAt` records the confirmed deletion time of the original object in private storage. `deletedAt` is the logical/record-level deletion timestamp for the upload metadata when a user or retention workflow requests record deletion; it must not be used as proof that the object was physically deleted. The record-level and object-level states must be updated through the coordinated deletion workflow.

## 15.4 AnalysisReport

Core fields:

- `id`
- `uploadedFileId`
- `status`
- `analysisDate`
- `completedAt`
- `totalIssues`
- `totalRows`
- `totalColumns`
- `ruleVersion`
- `failureCode`
- `createdAt`
- `updatedAt`

Relations: source upload, data-quality issues, one processing job, and multiple cleaning runs.

An uploaded file may have multiple analysis reports. A report remains a durable record of findings even after its source object expires, subject to the account/data deletion policy. Each report has one associated `ProcessingJob`; the report status is the user-facing outcome projection, while the associated `ProcessingJob` is the authoritative execution record. Status changes that affect both records must be committed in one database transaction. If a mismatch is detected, reconciliation must derive the report's processing outcome from the persisted job record and record the correction safely.

## 15.5 DataQualityIssue

Core fields:

- `id`
- `reportId`
- `issueType`
- `affectedColumn`
- `issueCount`
- `title`
- `description`
- `recommendation`
- `detectionStatus`
- `detectedPattern`
- `matchingValueCount`
- `nonMatchingValueCount`
- `unclassifiedValueCount`
- `totalNonEmptyValueCount`
- `matchPercentage`
- `recognisedPatterns` (structured JSON)
- `details` (structured JSON)
- `createdAt`

The model must retain enough evidence to explain a finding and reproduce the rule outcome without storing unnecessary raw dataset contents.

## 15.6 ProcessingJob

Core fields:

- `id`
- `reportId` (unique relationship to report)
- `queueJobId` (unique when assigned)
- `status`
- `attempts`
- `maxAttempts` (default 3 total attempts)
- `startedAt`
- `finishedAt`
- `lastHeartbeatAt`
- `leaseExpiresAt`
- `lastErrorCode`
- `createdAt`
- `updatedAt`

Purpose: persistent authoritative record of one analysis job.

## 15.7 CleaningRun

Core fields:

- `id`
- `userId`
- `reportId`
- `queueJobId` (unique when assigned)
- `idempotencyKey`
- `requestFingerprint` (server-generated hash of the report identifier and canonical selected-operation set)
- `status`
- `selectedOperations`
- `attempts`
- `maxAttempts`
- `originalRowCount`
- `finalRowCount`
- `whitespaceCellsTrimmed`
- `blankRowsRemoved`
- `duplicateRowsRemoved`
- `exportProtectedValueCount`
- `startedAt`
- `finishedAt`
- `lastHeartbeatAt`
- `leaseExpiresAt`
- `lastErrorCode`
- `createdAt`
- `updatedAt`

Enforce uniqueness of `(userId, idempotencyKey)` when an idempotency key is present. The server must calculate and persist a request fingerprint from the report identifier and the canonicalised selected-operation set. Reuse of the same key with the same fingerprint returns the existing logical request; reuse of the same key with a different fingerprint must be rejected as an idempotency conflict and must not create or alter a run. The run belongs to one user and one report and may have one cleaned file and multiple cleaning result issues.

## 15.8 CleanedFile

Core fields:

- `id`
- `cleaningRunId` (unique)
- `filename`
- `canonicalStorageKey`
- `safeExportStorageKey`
- `fileSizeBytes`
- `rowCount`
- `columnCount`
- `exportProtectedValueCount`
- `createdAt`
- `expiresAt`
- `deletionRequestedAt`
- `deletionStatus`
- `canonicalFileDeletedAt`
- `safeExportFileDeletedAt`
- `fileDeletedAt`

Do not store a redundant `userId` in `CleanedFile` in the approved baseline. Verify ownership through the associated `CleaningRun`, report and source upload. If a future design adds redundant ownership data, it must also enforce consistency at database level.

Both canonical and safe-export objects must be tracked for retention and deletion. `canonicalFileDeletedAt` and `safeExportFileDeletedAt` record the confirmed deletion time of each individual object. `fileDeletedAt` is set only when both objects have been confirmed deleted. The shared `deletionStatus` is `COMPLETED` only when both required objects are deleted; if one succeeds and the other fails, retain the successful timestamp, mark the overall operation `FAILED`, and retry only the remaining object.

## 15.9 CleaningResultIssue

Core fields:

- `id`
- `cleaningRunId`
- `issueType`
- `affectedColumn`
- `issueCount`
- `recommendation`
- `detectionStatus`
- `detectedPattern`
- `details`
- `createdAt`

These findings belong to the cleaning run and must never overwrite original `DataQualityIssue` records.

## 15.10 Relationships

- One user has many uploaded files.
- One user has many cleaning runs.
- One uploaded file can have multiple analysis reports.
- One analysis report has many data-quality issues.
- One analysis report has one processing job.
- One analysis report can have many cleaning runs.
- One cleaning run belongs to one user and one report.
- One cleaning run has one cleaned-file record when successfully completed.
- One cleaning run has many cleaning-result issues.

## 15.11 Enums and integrity controls

Use Prisma enums for upload status, job status, issue type, detection status, cleaning operation and deletion status.

The schema/migration must enforce:

- Unique user email.
- Unique report-to-processing-job relationship.
- Unique queue job identifiers where assigned.
- Unique cleaned file per cleaning run.
- Unique `(userId, idempotencyKey)` when the key is present.
- A persisted request fingerprint associated with each idempotency key; reject same-key/different-payload reuse.
- Foreign-key ownership relationships.
- Non-negative file sizes, row counts, column counts and issue counts.
- Non-negative attempts and attempts not exceeding configured maximum.
- Match percentage between 0 and 100 where present.
- Valid deletion-state transitions and required relationships where expressible.

Add SQL CHECK constraints through migrations where Prisma schema alone is insufficient. Validate ownership consistency in application services and, where feasible, database constraints.

## 15.12 Issue-count semantics

`issueCount` represents the number of affected cells or record occurrences for one finding category and column, according to that category's defined counting rule.

`totalIssues` is the sum of the persisted finding counts for that report. The UI must label this as **issue instances** or equivalent. It must not imply that the value represents unique affected rows or unique records. Where unique affected rows are useful, they must be separately calculated and labelled.

## 15.13 Ownership and deletion integrity

- Verify cleaning-run owner.
- Verify report belongs to the same owner.
- Verify source upload belongs to the same owner.
- Verify cleaned file belongs to the cleaning run.
- Never trust a client-provided user ID or storage key.
- Coordinate database deletion state with object-storage deletion.
- Record object deletion only after storage confirms success.
- Retry failed object deletions without falsely marking the object deleted.
- Preserve report and summary metadata after source-object expiry where policy permits.

---

# 16. Background queue reliability and idempotency (J05)

## 16.1 Sources of truth

PostgreSQL is the authoritative source for business job status and outcomes. BullMQ/Redis is the delivery and execution mechanism. A BullMQ job marked completed does not by itself mean the application job is completed; PostgreSQL must reflect a successfully persisted result.

## 16.2 Stable queue identifiers

Use stable deterministic queue IDs based on database records:

- Analysis: `analysis-{processingJobId}`
- Cleaning: `cleaning-{cleaningRunId}`

Queue IDs must not be generated randomly for retries of the same logical job.

## 16.3 Idempotency

BullMQ deduplication is not sufficient by itself. Workers must enforce idempotency using PostgreSQL state, unique constraints and deterministic output identifiers.

- A completed job must not be processed again as a new logical job.
- Repeated client submission must not create duplicate cleaning runs when it carries the same valid request idempotency key.
- A genuinely new user request must use a new idempotency key.
- Retries must not create duplicate reports or cleaned outputs.
- Deterministic object keys must be derived from stable run identifiers.
- If an object is stored but the database update fails, a retry must safely reuse or replace the deterministic object rather than publish a duplicate.

## 16.4 Database-to-queue coordination

Create the persistent database job record before queue submission. If Redis is unavailable, retain a recoverable queued database record. If private object storage succeeds but the corresponding database transaction or queue setup fails, the upload workflow must record or detect the orphaned object and remove it through a retry-safe cleanup process. An upload must not be shown as accepted unless its required database and storage state is durable.

Use a reconciliation process that periodically identifies eligible persisted jobs not successfully submitted to or represented in BullMQ and re-enqueues them with the same stable queue ID.

The approved Version 1 baseline uses reconciliation with the existing eight core models; it does not add a transactional-outbox model.

## 16.5 Worker lifecycle

A worker must:

1. Load the authoritative database record.
2. Verify that the job is eligible to run.
3. Verify source-file availability and retention state.
4. Atomically claim the job.
5. Record attempt, start time, heartbeat and lease.
6. Process the job.
7. Persist findings or output metadata.
8. Mark completed only after all required work is durable.
9. Record safe error code and retry/failure state on error.

A duplicate delivery must not repeat a completed job. For cleaning requests, the same idempotency key and same request fingerprint must resolve to the existing run; the same key with a different fingerprint must return a conflict response (for example, HTTP 409) without creating a second run.

## 16.6 Retry policy

- Maximum: three total attempts, including the initial attempt.
- Initial backoff delays: 30 seconds and 60 seconds; configurable server-side.
- Retry temporary queue, worker, database or storage interruptions where safe.
- Do not retry permanent validation errors, unsupported files, limit violations, expired source files or invalid cleaning selections.
- Do not exceed the maximum attempt count.

## 16.7 Worker crash recovery

Workers must maintain heartbeat/lease information. A recovery process identifies stale `PROCESSING` jobs, checks whether a worker still owns an active BullMQ execution, and recovers only jobs no longer actively running.

Recovery must:

- Respect the maximum attempt count.
- Avoid running two workers against the same logical job.
- Never reset a completed job to queued.
- Record recovery history and safe error codes.
- Preserve original files.

## 16.8 Safe output publication

A cleaning result is not complete until:

- Canonical output is fully generated.
- Output is structurally validated.
- Spreadsheet-safe export is generated and validated.
- Required private storage objects are confirmed.
- Metadata and summary are persisted.
- Database status is marked completed.

No partial output may be presented as a successful result. Abandoned temporary objects must be cleaned up safely.

## 16.9 Worker concurrency

Worker concurrency must be bounded and configurable. Two concurrent jobs per worker may be used as an initial test setting, not as a committed production capacity target. Benchmark memory and processing time before increasing concurrency.

## 16.10 Logging

Record job ID, job type, status, attempts, timestamps, duration, safe error code, worker identity and recovery history.

Never log raw CSV contents, passwords, authentication tokens, private storage keys or database credentials.

## 16.11 J05 acceptance tests

The reliability suite must include J05-01 through J05-18, covering stable IDs, duplicate delivery, request idempotency, completed-job protection, queue unavailability, reconciliation, worker crash, stale lease recovery, retry limits, permanent versus temporary errors, deterministic output keys, storage/database partial failure, output validation, safe publication, concurrent workers, status consistency and sensitive-log exclusion.

---

# 17. Database migration plan

This is the approved logical migration plan, not evidence that migrations have been generated or run.

1. **Core schema:** create the eight models, relations and required enums.
2. **Integrity:** add unique constraints, foreign keys, indexes and SQL CHECK constraints.
3. **Reliability:** add stable queue identifiers, idempotency, attempt counters, heartbeat/lease fields and error codes.
4. **Export safety:** add canonical and safe-export storage references and protection counts.
5. **Retention:** add expiry, deletion-request, deletion-status and actual-deletion fields/indexes.
6. **Verification:** test ownership, idempotency, retention, two-object export/deletion and recovery paths against a real test database.

The authentication provider/local-password decision must be finalised before implementing the authentication schema and flows. Migrations must be reviewed and tested before production deployment.

---

# 18. Security and privacy requirements

## 18.1 Authentication and authorisation

- Require authentication for private operations.
- Securely hash passwords if local authentication is used.
- Verify ownership for every private resource.
- Apply least privilege to application, worker, database and storage credentials.
- Do not disclose another user's resource existence through error messages.

## 18.2 File and storage security

- Store originals and generated files in private object storage.
- Do not use public buckets.
- Do not expose storage keys.
- Use short-lived signed URLs or authenticated streaming.
- Validate all uploads server-side.
- Enforce size, row and parser limits.
- Use secure transport in production.
- Protect environment variables and database credentials.
- Encrypt data at rest where supported by the selected infrastructure; verify provider configuration before launch.

## 18.3 Untrusted CSV content

- Treat every uploaded cell value as untrusted data.
- Never execute formulas or evaluate CSV cell contents.
- Never interpret uploaded content as application instructions.
- Render preview values as text.
- Prevent HTML/script injection in preview and report interfaces.
- Apply the separate spreadsheet-safe export process in Section 11.
- CSV quoting alone is not a formula-injection defence.

## 18.4 Logging and monitoring privacy

Do not log raw CSV contents, passwords, tokens, secrets, storage keys or unnecessary personal/business data. Logs must use safe identifiers and error codes.

## 18.5 Privacy principles

- Isolate user accounts and data.
- Explain what files are processed and how long they are retained.
- Provide a clear privacy policy before production use.
- Explain that uploaded data is processed to provide the requested service.
- Do not use uploaded data for unrelated purposes without a valid, disclosed basis and appropriate consent.
- Support user deletion requests subject to applicable legal and operational retention requirements.
- Do not claim regulatory certification or compliance until the applicable jurisdiction and legal obligations have been assessed.

## 18.6 Privacy open decisions

Applicable privacy jurisdiction, legal retention exceptions, account deletion handling and backup retention must be resolved before production launch.

---

# 19. Error handling and application states

## 19.1 Statuses

Analysis and cleaning jobs use:

- `QUEUED`
- `PROCESSING`
- `COMPLETED`
- `FAILED`

Upload and deletion workflows may use their own dedicated enums as specified in the database model.

## 19.2 Permanent failures

Examples include:

- Unsupported file type.
- Invalid CSV structure.
- Unsupported encoding.
- File-size or row-limit violation.
- Expired source file.
- Invalid cleaning selection.

Permanent errors must not be retried indefinitely.

## 19.3 Temporary failures

Examples include:

- Temporary object-storage interruption.
- Temporary database connectivity failure.
- Temporary queue/Redis interruption.
- Worker interruption.

Temporary failures may be retried under J05 rules.

## 19.4 User-facing messages

Examples:

- “Your file is being analysed.”
- “Your analysis is complete.”
- “Your file could not be processed. Please check that it is a valid supported CSV.”
- “Your cleaned file is being generated.”
- “Your cleaned file is ready to preview.”
- “Your cleaned file could not be generated. Your original file has not been changed.”
- “This download has expired.”

Do not expose stack traces, database errors, internal storage paths or secrets.

## 19.5 State consistency

PostgreSQL is the source of truth for displayed business status. The UI must reflect persisted state, including after refresh. Queue events may support updates but must not override authoritative database state.

---

# 20. Non-functional requirements

## 20.1 Performance

- Process accepted files asynchronously.
- Enforce the 25 MiB and 100,000-row defaults.
- Use 50-row preview pagination by default.
- Avoid loading the full dataset into browser memory.
- Bound worker concurrency.
- Display persisted processing status.
- Do not promise a fixed analysis completion time until representative benchmarks have been completed.

## 20.2 Reliability

- Persist analysis and cleaning state in PostgreSQL.
- Use BullMQ/Redis for background execution.
- Apply three total attempts and configurable backoff.
- Enforce idempotency.
- Recover eligible queued and stale jobs.
- Prevent duplicate outputs.
- Preserve original files after processing failures.
- Publish only validated, fully stored outputs.

## 20.3 Usability

- Use plain English.
- Explain findings and cleaning operations.
- Distinguish original findings, changes made and remaining findings.
- Display safe and useful failure messages.
- Communicate file expiry and download availability.
- Avoid requiring SQL, programming or advanced analytics knowledge.

## 20.4 Mobile and accessibility

- Support common mobile and desktop layouts.
- Keep tables usable on narrow screens.
- Provide keyboard navigation and visible focus.
- Do not rely on colour alone to communicate status.
- Final accessibility standard and browser/device matrix remain open decisions.

## 20.5 Maintainability

Keep UI, parser, validation, detection, cleaning, export safety, workers, storage and database services logically separated. Core processing rules must be unit-testable without rendering the application.

## 20.6 Initial operating defaults

| Limit or policy | Initial value |
|---|---:|
| Maximum file size | 25 MiB |
| Maximum data rows | 100,000 |
| Preview page size | 50 rows |
| Maximum job attempts | 3 total |
| Retry backoff | 30s then 60s, configurable |
| Successful original retention | 30 days after successful analysis |
| Failed-analysis original retention | 7 days after final permanent failure |
| Cleaned output retention | 30 days after creation |

Server-side settings control operational limits. Untrusted browser input must not override them.

## 20.7 Monitoring

Monitor:

- Upload success/failure.
- Analysis and cleaning success/failure.
- Processing duration.
- Queue delay.
- Retry rate.
- Stale-job recovery.
- Storage deletion success/failure.
- Parser, database, queue and worker errors.
- Worker memory and concurrency.

Do not include raw CSV content or secrets in telemetry.

## 20.8 Open non-functional decisions

- Performance benchmarks and target completion times.
- Availability/service-level target.
- Backup frequency, retention and restoration objectives.
- Worker concurrency for production.
- Accessibility standard.
- Supported browser/device matrix.
- Load-test concurrency and representative workload.

---

# 21. File storage, retention and deletion (J06)

## 21.1 Storage principles

Original and generated CSV files must be stored in private object storage, not as permanent database blobs. Database records hold metadata and private storage references.

## 21.2 Successful original-file retention

Default: retain the original CSV for 30 days after successful analysis.

After expiry:

- Prevent new cleaning runs from using the expired source.
- Check authoritative PostgreSQL state.
- Confirm no active job still requires the object.
- Delete the object from private storage.
- Record actual deletion time only after storage confirms success.
- Retain the analysis report and findings according to policy.
- Display expiry information to the user.

## 21.3 Failed-analysis original-file retention

Default: retain an original file for seven days after the analysis reaches final permanent failure.

The retention clock starts only when:

- A permanent failure is recorded; or
- All permitted attempts have been exhausted and the job is finally failed.

Do not start the failed-analysis retention clock while a job is active or remains eligible for retry.

After expiry:

- Check PostgreSQL authoritative state.
- Verify that no active or retry-eligible job needs the source.
- Delete the private object.
- Record actual deletion only after confirmed storage deletion.
- Retry temporary deletion failures.
- Retain safe failure metadata.
- Do not create a successful analysis report for a failed analysis.
- Require a new upload if the user wants another analysis after the source expires.

## 21.4 Multiple analysis reports for one upload

If an upload has multiple analysis reports:

- An active analysis or retry-eligible job blocks source deletion.
- If at least one analysis succeeds, the successful-analysis 30-day retention policy applies. Set or refresh `expiresAt` to 30 days after the most recent successful analysis completion. A later permanently failed analysis does not shorten that successful-analysis retention period.
- If all analyses permanently fail and none is active or retry-eligible, the seven-day failed-analysis policy applies, measured from the final permanent failure of the last eligible analysis attempt.
- Any explicit user deletion request is handled through the safe deletion workflow, subject to active-job protection and legal requirements.

The retention scheduler must evaluate the upload as a whole, not delete an object based on one report while another report is active or retry-eligible.

## 21.5 Cleaned-file retention

Retain generated cleaned-file objects for 30 days after creation.

Both canonical and spreadsheet-safe export objects must be tracked. On expiry:

- Block preview/download of expired objects.
- Delete each object from private storage.
- Record each actual deletion only after confirmed success.
- Retry temporary deletion failures.
- Retain cleaning summary and permitted report metadata.
- Display that the download has expired.

## 21.6 Deletion workflow

Deletion must be retry-safe and coordinated between PostgreSQL and object storage.

- Mark deletion as pending before attempting storage deletion.
- Do not report deletion as completed until storage confirms success.
- Record failed deletion state and safe error information.
- Retry temporary storage failures.
- Do not delete files currently needed by active processing.
- Preserve metadata needed to explain historical reports and cleaning outcomes where policy permits.

## 21.7 Account and user-requested deletion

Users must be able to request deletion of their own records and associated private files. Account deletion must trigger deletion of associated data and file objects, subject to applicable legal and operational retention requirements. Exact exceptions, backup expiry and jurisdiction-specific obligations remain open decisions.

## 21.8 Retention summary

| Data/object | Default retention |
|---|---|
| Original CSV after successful analysis | 30 days after successful analysis |
| Original CSV after final permanent analysis failure | 7 days after final permanent failure |
| Canonical cleaned CSV | 30 days after creation |
| Spreadsheet-safe cleaned export | 30 days after creation |
| Analysis reports/findings | May remain after source expiry, subject to account deletion and applicable policy |
| Cleaning summaries | May remain after output expiry, subject to account deletion and applicable policy |
| Backups | Policy unresolved; must be documented before production |

---

# 22. AI and AI-related tools

## 22.1 Version 1

AI is not required for core analysis or cleaning. Use deterministic TypeScript logic for:

- Missing-value detection.
- Exact duplicate detection.
- Supported format detection.
- Whitespace detection.
- User-selected cleaning operations.
- Post-cleaning validation.
- Export-safety handling.

The product must not use AI to silently alter business data.

## 22.2 Future possibilities

Future versions may consider AI for explanations, contextual recommendations and advanced diagnosis. These are not Version 1 requirements and must not delay v1.

---

# 23. Business model

The Version 1 priority is to build and validate a useful working product. The final commercial model is not required for initial development.

Possible future models include free access with limits, freemium access and subscription plans. Payment integration is excluded from Version 1. Any operational abuse limits required for safe service operation must be distinguished from future commercial plan limits.

---

# 24. Success metrics

## 24.1 Product usage

- Registered users.
- CSV files uploaded.
- Completed analyses.
- Cleaning runs created.
- Cleaned outputs generated.
- Cleaned files previewed.
- Cleaned files downloaded.
- Returning users.

## 24.2 Processing performance

- Successful analysis percentage.
- Analysis completion time distribution.
- Upload failure rate.
- Processing retry rate.
- Cleaning failure rate.
- Queue delay.
- Storage deletion success/failure rate.

## 24.3 Cleaning performance

- Successful cleaning-run percentage.
- Cells trimmed.
- Blank rows removed.
- Duplicate rows removed.
- Export-protected values.
- Preview-to-download conversion.

## 24.4 Accuracy and safety

- Correct missing-value detection.
- Correct duplicate detection.
- Correct supported format detection.
- Correct whitespace detection.
- Correct execution of selected operations.
- Correct post-cleaning validation.
- Correct formula-injection protection.
- Original-file preservation.

## 24.5 User satisfaction

- Ease of upload.
- Ease of understanding reports.
- Ease of selecting operations.
- Usefulness of preview.
- Confidence in downloaded output.

Numerical targets must be set after representative testing. Do not invent targets before benchmarks.

---

# 25. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Incorrect findings | Conservative deterministic rules and labelled `NOT_ASSESSED` outcomes |
| Accidental record removal | Optional row-removal operations, explanations, confirmation and preserved original |
| Incorrect automatic correction | No automatic filling or ambiguous format normalisation |
| Large-file resource use | File/row limits, asynchronous processing, bounded concurrency and paginated preview |
| Confidential file exposure | Private storage, ownership checks, short-lived access and secure credentials |
| Queue or worker failure | Persistent DB records, idempotency, retries, reconciliation and recovery |
| Original/cleaned file confusion | Clear names, separate records and separate UI labels |
| Partial output publication | Validate and store all required output objects before marking completed |
| Formula injection | Separate spreadsheet-safe export, conservative neutralisation and spreadsheet compatibility tests |
| Failed deletion | Pending/failed states, retry-safe deletion and confirmation before recording completion |
| Unresolved legal obligations | Jurisdiction and retention review before production |

---

# 26. Testing strategy and acceptance criteria

## 26.1 Testing layers

### Unit tests

Test CSV validation, parser behaviour, missing-value detection, duplicate detection, format detection, whitespace detection, cleaning operations, export safety, issue aggregation and retention decision logic.

### Integration tests

Test PostgreSQL/Prisma relationships and constraints, object storage, Redis/BullMQ, workers, idempotency, retry behaviour, reconciliation and deletion workflows.

### End-to-end tests

Test registration/authentication, upload, validation, analysis, report review, cleaning selection, confirmation, output generation, preview, remaining findings and download.

### Security and privacy tests

Test cross-user access, ownership checks, private storage, signed URL expiry, unsafe preview values, formula-like CSV content, sensitive-log exclusion and deletion controls.

### Performance and recovery tests

Test near-limit files, queue delays, worker concurrency, worker crashes, storage/database interruptions, retry limits, stale recovery and memory use.

## 26.2 Test dataset library

Maintain controlled fixtures for:

- Clean CSV.
- Missing and whitespace-only values.
- Fully blank rows.
- Exact duplicates.
- Rows differing only by whitespace.
- Supported date formats.
- Ambiguous date formats.
- Supported and ambiguous numeric formats.
- Boolean-like values.
- Mixed/competing patterns.
- Quoted commas, newlines and escaped quotes.
- Malformed CSV.
- Invalid UTF-8 and BOM.
- Formula-like values and leading control characters.
- Near-limit and over-limit files.
- Unsupported delimiters.
- Maximum columns and field sizes when resolved.

## 26.3 Technical acceptance suites

- J01: database relationships, ownership, constraints, issue-count semantics, deletion references and idempotency.
- J02: CV-001 through CV-017 validation tests.
- J03: FD-001 through FD-016 format-detection tests.
- J04: EX-AT-01 through EX-AT-14 export-safety tests.
- J05: J05-01 through J05-18 queue/reliability tests.
- J06: J06-01 through J06-14 failed-analysis retention and deletion tests.

The detailed test cases must be implemented as executable tests and retained as project evidence. Their identifiers in this PRD do not imply that tests have already passed.

## 26.4 Additional end-to-end acceptance criteria

### Authentication and dashboard

1. Visitor can access public landing page.
2. User can register and authenticate using the selected authentication approach.
3. Authenticated user can access dashboard.
4. User cannot access another user's files, reports, cleaning runs, previews or downloads.

### Upload and analysis

5. Valid supported CSV can be uploaded.
6. Invalid CSV is rejected with the correct error category.
7. Original is stored privately and remains unchanged.
8. Upload/report/job records are created consistently.
9. Analysis runs asynchronously.
10. Four detection categories produce expected results.
11. Report contains correct counts, affected columns and explanations.
12. Failed analysis is not presented as a successful report.

### Cleaning

13. User can open completed report.
14. User can select supported cleaning operations.
15. Default selections are correct.
16. Confirmation is required.
17. At least one operation is required.
18. Operations execute in the specified order.
19. Separate output is generated.
20. Original remains unchanged.
21. Cleaning counts and findings are persisted.
22. Retries do not create duplicate output.
23. Partial output is never presented as complete.

### Preview and download

24. Completed output can be previewed.
25. Preview shows correct headers and rows.
26. Preview paginates at 50 rows by default.
27. Preview is read-only and renders values as text.
28. Summary distinguishes original findings, changes and remaining findings.
29. Spreadsheet-safe output is generated separately from canonical cleaned data.
30. Export-protection count and disclosure are correct.
31. Only the owner can download.
32. Expired output cannot be previewed or downloaded.

### Reliability, security and retention

33. Status persists after refresh.
34. Temporary failures are retried within configured limits.
35. Duplicate job delivery is safe.
36. Worker recovery does not duplicate completed work.
37. Storage deletion failures are recorded and retried.
38. Expired original and cleaned objects are deleted according to policy.
39. Reports and summaries remain available according to retention policy.
40. Cross-user access tests pass.
41. Sensitive data is excluded from logs.
42. Mobile and accessibility checks pass for the agreed support matrix.

## 26.5 Release gates

Production release is blocked by any unresolved critical issue involving:

- Cross-user access or private-file exposure.
- Incorrect data alteration or loss of original file.
- Incorrect cleaning operation execution.
- Unsafe formula-injection handling.
- Duplicate or partial output publication.
- Unreliable deletion that falsely reports data removed.
- Failure to enforce file and parser limits.

Release readiness requires evidence for functional, data-accuracy, security, reliability, retention, usability and recovery testing. Do not claim release readiness until the gates have been executed and reviewed.

---

# 27. Open decisions and pre-launch requirements

The following decisions remain open. They are intentionally not resolved by assumption.

| ID | Open decision | Required resolution |
|---|---|---|
| OD-01 | Authentication provider vs local-password authentication | Select provider and finalise account model before auth implementation |
| OD-02 | Email verification | Decide whether required for account activation |
| OD-03 | Password recovery | Define secure recovery workflow if local passwords are used |
| OD-04 | Maximum column count and field size | Set safe parser and operational limits |
| OD-05 | Delimiter handling | Preserve comma-only support; finalise unsupported-delimiter detection heuristic and tests |
| OD-06 | Header whitespace warning | Decide whether to warn while preserving exact header text |
| OD-07 | Backup and disaster recovery | Define backup schedule, retention and restore objectives |
| OD-08 | Privacy jurisdiction | Identify applicable jurisdictions and legal obligations |
| OD-09 | Account deletion/legal exceptions | Define deletion workflow, lawful retention and backup expiry |
| OD-10 | Performance targets | Benchmark representative datasets and set targets |
| OD-11 | Worker concurrency | Benchmark and configure production concurrency |
| OD-12 | Accessibility/browser support | Select standard and supported browser/device matrix |

## 27.1 Decision gates

The open decisions are not all equal blockers. Apply the following gates:

| Decision group | Required timing | Gate |
|---|---|---|
| OD-01 authentication approach | Before authentication implementation | **Pre-build blocker** |
| OD-02 email verification and OD-03 password recovery | Before authentication flow is considered complete | **Pre-build / authentication milestone** |
| OD-04 maximum columns and field size | Before CSV parser is accepted as complete | **Pre-build / CSV milestone** |
| OD-05 unsupported-delimiter heuristic | Before CSV validation is accepted as complete | **Build-stage decision** |
| OD-06 header whitespace warning | Before finalising upload-validation UX; header text must remain unchanged | **Build-stage decision; may be explicitly deferred** |
| OD-07 backups, OD-08 privacy jurisdiction, OD-09 deletion/legal exceptions | Before production data is accepted | **Pre-launch blocker** |
| OD-10 performance targets | After representative benchmarks and before production release | **Pre-launch blocker** |
| OD-11 production worker concurrency | After load and memory testing, before production release | **Pre-launch blocker** |
| OD-12 accessibility standard and browser/device matrix | Before production release | **Pre-launch blocker** |

The PRD may serve as the approved development baseline while pre-launch decisions remain open. A gated decision must be resolved before the milestone or release named above; it must not be silently assumed.

## 27.2 Pre-launch checklist

Before production launch:

- Resolve OD-01 to OD-12 or document an approved deferral that does not compromise safety or legal obligations.
- Finalise authentication and recovery flows.
- Set maximum columns and field size.
- Complete backup and restore testing.
- Review privacy policy and applicable legal requirements.
- Verify storage encryption/access configuration.
- Test spreadsheet-safe exports in supported spreadsheet applications.
- Run all critical acceptance and recovery tests.
- Configure monitoring, alerting and operational runbooks.
- Verify retention and deletion jobs in a production-like environment.

---

# 28. Implementation priority and milestones

Implementation begins only after the PRD has been finalised and the user explicitly moves to the build stage.

## Milestone 1 — Foundation

- Create Next.js and TypeScript application.
- Configure environment and project structure.
- Configure PostgreSQL and Prisma.
- Implement selected authentication approach.
- Configure private object storage.
- Add database schema, migrations and constraints.
- Implement ownership and authorisation.

## Milestone 2 — CSV intelligence

- Implement parser and validation.
- Implement stable validation errors.
- Implement missing-value detection.
- Implement duplicate detection.
- Implement conservative format detection.
- Implement whitespace detection.
- Add unit and fixture tests.

## Milestone 3 — Analysis experience

- Implement upload workflow.
- Persist analysis jobs.
- Configure Redis and BullMQ.
- Implement analysis worker and reconciliation.
- Implement report persistence and UI.
- Implement statuses, retry and recovery.

## Milestone 4 — Controlled cleaning

- Implement cleaning selection and confirmation.
- Implement three operations in fixed order.
- Implement request idempotency.
- Implement cleaning worker and recovery.
- Generate canonical output.
- Generate cleaning summary and post-cleaning findings.

## Milestone 5 — Delivery and safety

- Implement export-safety module.
- Generate and validate spreadsheet-safe export.
- Implement private storage of both outputs.
- Implement read-only 50-row preview.
- Implement authenticated download.
- Implement retention and deletion workers.

## Milestone 6 — Release readiness

- Execute unit, integration, end-to-end and security tests.
- Execute performance and recovery tests.
- Complete privacy, backup and accessibility decisions.
- Configure monitoring and operational procedures.
- Review release gates and deployment readiness.

---

# 29. Future Version 2

The following are intentionally excluded from Version 1 and may be evaluated after the core product is validated:

## 29.1 Advanced data diagnosis

- Detailed dataset profiling.
- Statistical examination.
- Distribution analysis.
- Advanced anomaly detection.
- Deeper data interpretation.

## 29.2 Business calculations

- Business-specific calculations.
- Advanced sales calculations.
- Inventory valuation.
- Revenue and profit analysis.
- Advanced statistical calculations.

## 29.3 Business reporting dashboard

- Sales and inventory KPI cards.
- Trend charts.
- Product and category analysis.
- Advanced filters.
- Interactive business reporting.

## 29.4 Additional cleaning

- User-approved missing-value replacement.
- Configurable format normalisation.
- Additional transformations.
- Manual cell editing.
- Advanced cleaning rules.

## 29.5 Additional file support

- XLSX uploads.
- Google Sheets integration.
- Other spreadsheet formats.

These features must not delay Version 1 delivery.

---

# 30. Final Version 1 product definition

DataMedics Version 1 is a web application that allows authenticated users to upload supported CSV files, validate them, identify common data-quality problems, understand the findings, select and confirm supported cleaning operations, generate a separate cleaned CSV, preview the result and download a spreadsheet-safe representation.

The product preserves the original uploaded file, uses deterministic processing, protects private business data, handles background work reliably and clearly reports unresolved findings.

The five core product capabilities are:

1. CSV upload and validation.
2. Data-quality analysis.
3. Data-quality reporting and recommendations.
4. Controlled cleaned CSV generation.
5. Cleaned-data preview and safe download.

The product prioritises accuracy, simplicity, data protection, user control, reliable processing, explainable results and mobile usability.

DataMedics will establish a dependable CSV data-quality and cleaning foundation before expanding into advanced data diagnosis, business calculations and business intelligence.

**End of consolidated DataMedics Version 1 PRD.**


---

# 31. Final quality review and sign-off

## 31.1 Quality-review outcome

The consolidated PRD has completed a final documentation and technical-consistency review. The review checked:

- Preservation of the approved DataMedics product vision and Version 1 boundaries.
- Integration of the original PRD v1.3 and approved amendments J01–J06.
- Consistency between user journeys, functional requirements, cleaning rules, output requirements and API responsibilities.
- Consistency of the eight-model database baseline with ownership, queue, idempotency and retention requirements.
- Clear separation of canonical cleaned data from spreadsheet-safe export.
- Consistency of job status, retry, recovery and deletion behaviour.
- Explicit distinction between approved requirements, implementation specifications and open decisions.
- Clear distinction between a final PRD and an implemented or tested application.

## 31.2 Final review corrections

The following clarifications were incorporated without expanding Version 1:

1. The 100,000-row limit counts logical parsed data records after the header, including fully blank records; quoted multiline fields do not count as multiple records.
2. Format-detection confidence is calculated against all non-empty values for the assessed format category, with the unrounded ratio compared to the 80% threshold.
3. Spreadsheet-safety neutralisation is applied to parsed cell values before CSV serialization; canonical cleaned data remains unchanged.
4. `AnalysisReport.status` is the user-facing outcome projection, while `ProcessingJob` is the authoritative analysis execution record. Related status updates are transactionally consistent.
5. Cleaning idempotency now includes a server-generated request fingerprint. Reusing a key with a different request payload is rejected rather than silently reusing or changing a run.
6. Original-upload and cleaned-output deletion timestamps are defined separately from logical record deletion. A two-object cleaned-file deletion is complete only after both objects are confirmed deleted.
7. Multiple analysis reports for one upload are covered by one retention decision. Active or retry-eligible jobs block deletion; successful-analysis retention takes precedence over a later failed attempt.
8. Storage objects created without a successfully committed database/upload state must be detected and removed through retry-safe orphan cleanup.
9. Open decisions are classified by when they must be resolved, so development can proceed in stages without treating pre-launch choices as arbitrary pre-build blockers.

## 31.3 Approved Version 1 baseline

The following remain locked for Version 1:

- CSV-only input.
- Maximum 25 MiB file size and 100,000 logical data records as initial operating defaults.
- UTF-8 input with UTF-8 BOM accepted.
- Four data-quality categories: missing values, exact duplicate rows, supported inconsistent formats and unnecessary whitespace.
- Three user-selected cleaning operations: trim whitespace, remove fully blank rows and remove exact duplicate rows.
- Deterministic processing; no AI-based automatic correction.
- Separate canonical cleaned data and spreadsheet-safe download representation.
- Read-only 50-row paginated preview by default.
- Original-file preservation.
- Approved stack: Next.js, TypeScript, Prisma, PostgreSQL, BullMQ, Redis and private object storage.
- Eight core database models.
- Three total processing attempts with configurable retry backoff.
- Approved retention defaults and J01–J06 safeguards.
- No Version 2 analytics, business intelligence, payment or expanded file-format features in Version 1.

Any change to these boundaries requires an explicit product-scope change approval.

## 31.4 Remaining gates

The open decisions in Section 27 remain visible and must be resolved at their assigned gates. In particular, authentication approach and parser resource limits must be settled before their respective implementation milestones. Privacy jurisdiction, backup/recovery, legal deletion exceptions, production performance, worker concurrency and support matrix must be resolved before production launch.

No requirement in this PRD should be interpreted as proof that software, database migrations, infrastructure, security controls or tests have already been implemented or passed.

## 31.5 Sign-off status

**Document status:** Final quality-reviewed Version 1 PRD baseline.

**Product scope status:** Approved and locked.

**Technical specification status:** Approved baseline, subject to the explicit decision gates in Section 27.

**Development status:** Not started by this document.

**Production-readiness status:** Not established; requires implementation, testing and completion of pre-launch gates.

**End of final DataMedics Version 1 PRD.**
