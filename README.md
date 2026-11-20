# DataMedics

**DataMedics** is a web-based CSV data-quality analysis and controlled-cleaning application built for high reliability, data preservation, and security.

It inspects CSV files for structural defects and data-quality issues using deterministic rules, provides actionable recommendations, executes user-controlled cleaning operations in a strict fixed order, generates separate cleaned outputs, provides a read-only preview, and delivers spreadsheet-safe exports protected against formula injection (CWE-1236).

---

## Key Features

### 1. CSV Parsing & Structural Validation (PRD §7, Amendment J02)
- State-machine parser conforming strictly to **RFC 4180**.
- Handles UTF-8 encoding and strips UTF-8 BOM transparently.
- Correctly parses quoted commas, escaped double-quotes (`""`), and multiline values.
- Rejects malformed records, uneven column widths, missing/blank/duplicate headers, and unsupported delimiters.
- Enforces server-side limits on file size, logical row count, column count, and field length.

### 2. Four Deterministic Data-Quality Detection Modules (PRD §8, Amendment J03)
- **Missing Values:** Flags empty and whitespace-only cells. Preserves legitimate values (`0`, `0.00`, `NULL`, `N/A`, `unknown`). Excludes fully blank rows from the denominator.
- **Exact Duplicate Rows:** Compares parsed cell values as exact strings without case folding or trimming. Excludes fully blank rows.
- **Inconsistent Formats:** Evaluates columns against an 80% dominant pattern threshold (minimum 2 distinct non-empty values). Detects date, numeric, and boolean variations using versioned pattern catalogue v1.0.0. Returns `NOT_ASSESSED` when confidence is insufficient.
- **Unnecessary Whitespace:** Identifies leading and trailing spaces, tabs, line breaks, and Unicode whitespace without flagging normal spaces between words or double-counting whitespace-only cells.

### 3. User-Controlled Cleaning (PRD §9, §10)
Applies exactly three operations in a deterministic, fixed sequence:
1. **Trim leading and trailing whitespace** *(default: selected)*
2. **Remove fully blank rows** *(default: not selected; requires confirmation)*
3. **Remove exact duplicate rows** *(default: not selected; requires confirmation)*

*Guarantees:*
- **Original File Preservation:** Original uploaded files are never overwritten, modified, or mutated.
- **No Data Fabrication:** Does not guess missing values, infer types, or silently reformat dates/currencies.
- **Explicit Confirmation:** Displays row-reduction warnings and requires explicit user confirmation before starting cleaning.

### 4. Spreadsheet-Safe Export (PRD §11, §18, Amendment J04)
- Treats CSV values as untrusted input; never evaluates formulas.
- Neutralizes formula-injection vectors (CWE-1236) beginning with `=`, `+`, `-`, or `@`, including values preceded by leading whitespace or control characters (`\t`, `\r`, `\n`, `\x00`–`\x1F`, `\x7F`).
- Reliably classifies and **preserves legitimate negative numbers** (`-42`, `-3.14`, `-1e5`).
- Prefixes suspicious values with an apostrophe (`'`), forcing spreadsheet software (Excel, LibreOffice, Google Sheets) to treat content as plain text.
- Maintains canonical cleaned CSV separate from spreadsheet-safe export.

### 5. Cleaned-Data Preview & Authenticated Download (PRD §10, §11, §18)
- **Read-Only Preview:** Server-side 50-row pagination. Renders values as plain text; does not load the entire dataset into browser memory.
- **Authenticated Download:** Enforces ownership checks; delivers **only** the spreadsheet-safe representation; blocks expired or deleted outputs (`410 Gone`).

### 6. File Retention & Safe Deletion (PRD §21, Amendment J06)
- **Successful Original Files:** Retained for 30 days after successful analysis.
- **Failed Original Files:** Retained for 7 days after final permanent failure.
- **Cleaned Outputs:** Retained for 30 days from creation.
- **Active Job Protection:** Active or retry-eligible jobs block original file deletion.
- **Physical Confirmation:** Confirms object deletion from storage before marking deletion completed in PostgreSQL.
- **Audit Preservation:** Permitted historical analysis reports, findings, and cleaning summaries remain accessible after physical file deletion.

---

## Approved Technology Stack

| Component | Technology | Version | Purpose |
|---|---|---|---|
| Framework | **Next.js** (App Router) | 15.0.3 | Full-stack application & server routes |
| Runtime / UI | **React** | 18.3.1 | User interface & dashboard |
| Language | **TypeScript** | 5.6.3 | Type safety and strict domain boundaries |
| Database ORM | **Prisma** | 6.0.1 | PostgreSQL schema, migrations & relationships |
| Database | **PostgreSQL** | 15+ | Authoritative application state |
| Queue Delivery | **BullMQ** | 5.25.6 | Background job scheduling & retries |
| Queue Broker | **Redis** | 7+ | In-memory message transport |
| Test Runner | **Vitest** | 2.1.5 | Fast unit, integration, and acceptance testing |

---

## Repository Structure

```
DataMedics/
├── Docs/                              # PRD, Rules, and Skill specifications
│   ├── DataMedics_PRD_v1.5_Final.md   # Authoritative product requirements
│   ├── .agent/rules/                  # Security, testing, decisions, and evidence
│   └── Skills/skills/                 # Procedural skill files
├── prisma/
│   ├── schema.prisma                  # 8 core models, 7 enums, and indexes
│   └── migrations/                    # SQL DDL migrations with SQL CHECK constraints
├── src/
│   ├── app/                           # Next.js App Router (pages & API routes)
│   │   ├── (auth)/                    # Login & Registration pages
│   │   ├── (dashboard)/               # Dashboard, Reports, Cleaning & Preview pages
│   │   └── api/                       # Auth, Upload, Report, Cleaning & Download APIs
│   ├── engine/                        # Core deterministic business logic
│   │   ├── csv/                       # RFC 4180 parser & structural validator
│   │   ├── detection/                 # 4 detection engines & aggregator
│   │   ├── cleaning/                  # 3 controlled cleaning operations & runner
│   │   └── export/                    # Spreadsheet-safe formula neutralisation
│   ├── lib/                           # Database, Redis, storage, auth, and config
│   ├── services/                      # Repositories, jobs reconciliation, retention
│   ├── types/                         # Shared TypeScript models and interfaces
│   └── workers/                       # Analysis, Cleaning, and Expiry background workers
└── tests/
    ├── fixtures/                      # Test CSV files (clean, malformed, multiline, etc.)
    └── unit/                          # 140 automated acceptance tests across 12 suites
```

---

## Getting Started

### Prerequisites
- **Node.js:** v18.18+ or v20+
- **npm:** v9+
- **PostgreSQL:** v15+ *(optional for development via in-memory repository)*
- **Redis:** v7+ *(optional for development via in-memory worker invocation)*

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/your-org/datamedics.git
cd datamedics
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Key configuration parameters:
- `DATABASE_URL`: PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/datamedics`)
- `REDIS_URL`: Redis connection string (e.g. `redis://localhost:6379`)
- `SESSION_SECRET`: 32+ character random string for HMAC session token signing
- `STORAGE_PROVIDER`: Object storage provider (`memory`, `s3`, `gcs`)
- `PORT`: Application HTTP port (default `3000`)

### 3. Database Schema
Generate Prisma client and validate the schema:
```bash
npm run prisma:generate
npm run prisma:validate
```

To apply migrations to your development PostgreSQL instance:
```bash
npx prisma migrate dev
```

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Production Build
```bash
npm run type-check
npm run build
npm run start
```

---

## Verification & Testing

DataMedics includes an extensive automated test suite covering all PRD acceptance criteria:

```bash
# Run all unit and integration tests
npm run test:unit

# Run TypeScript type-checking
npm run type-check
```

### Test Suites Overview (140 Tests, 12 Suites)

| Test Suite | File | Tests | Coverage |
|---|---|---|---|
| **CSV Validation** | `tests/unit/csv-validation.test.ts` | 18 | `CV-001` through `CV-017` + delimiter tests |
| **Format Detection** | `tests/unit/format-detection.test.ts` | 16 | `FD-001` through `FD-016` (dates, numbers, booleans) |
| **Data Quality Engines** | `tests/unit/data-quality.test.ts` | 8 | Missing values, exact duplicates, whitespace, aggregation |
| **Controlled Cleaning** | `tests/unit/cleaning.test.ts` | 37 | Operations, ordering, combinations, idempotency, worker |
| **Export Safety** | `tests/unit/export-safety.test.ts` | 15 | `EX-AT-01` through `EX-AT-14` (formula injection, negative numbers) |
| **Retention & Deletion** | `tests/unit/retention-deletion.test.ts` | 15 | `J06-01` through `J06-14` (30d/7d retention, physical deletion) |
| **Delivery & Preview** | `tests/unit/delivery.test.ts` | 10 | Preview pagination, ownership, authenticated download, 410 Gone |
| **Analysis Experience** | `tests/unit/analysis-experience.test.ts` | 7 | Auth scrypt, upload pipeline, BullMQ queue, reconciliation |
| **Auth & Security** | `tests/unit/auth.test.ts` | 5 | Ownership assertions, uniform 404 anti-enumeration |
| **Private Storage** | `tests/unit/storage.test.ts` | 3 | Key prefixes, path traversal sanitization, signed URLs |
| **Database Models** | `tests/unit/models.test.ts` | 2 | 8 models, 7 enums, SQL CHECK constraints |
| **Smoke Tests** | `tests/unit/smoke.test.ts` | 4 | Config, deterministic queue IDs, storage keys |

---

## Security & Architecture Highlights

1. **Authentication & Session Tokens:** Passwords hashed with `crypto.scrypt` using individual 16-byte cryptographically secure salts. Sessions managed via signed HMAC-SHA256 cookies (`datamedics_session`).
2. **Anti-Enumeration Protection:** Cross-user resource requests return uniform `404 Not Found` rather than `403 Forbidden`, preventing discovery of valid record identifiers.
3. **Private Object Storage:** Storage keys are server-generated UUIDs (`uploads/...`, `canonical/...`, `safe-export/...`). User-provided filenames are never used in storage keys.
4. **Authoritative State:** PostgreSQL is the single source of truth for job states. BullMQ serves strictly as the delivery mechanism; jobs check DB status before processing to ensure idempotency.
5. **No AI in Core Processing:** CSV parsing, detection, cleaning, and export safety are 100% deterministic TypeScript algorithms without probabilistic AI alterations.

---

## Documentation & Governance

- **Product Requirements Document:** [Docs/DataMedics_PRD_v1.5_Final.md](file:///c:/Users/DELL/OneDrive/Desktop/DataMedics/Docs/DataMedics_PRD_v1.5_Final.md)
- **Project Guidelines & Rules:** [AGENTS.md](file:///c:/Users/DELL/OneDrive/Desktop/DataMedics/AGENTS.md)
- **Decisions Register:** [Docs/.agent/rules/.decision.md](file:///c:/Users/DELL/OneDrive/Desktop/DataMedics/Docs/.agent/rules/.decision.md)
- **Security Baseline:** [Docs/.agent/rules/.security.md](file:///c:/Users/DELL/OneDrive/Desktop/DataMedics/Docs/.agent/rules/.security.md)
- **Testing Standard:** [Docs/.agent/rules/.testing.md](file:///c:/Users/DELL/OneDrive/Desktop/DataMedics/Docs/.agent/rules/.testing.md)
- **Test Evidence Log:** [Docs/.agent/rules/.test-evidence.md](file:///c:/Users/DELL/OneDrive/Desktop/DataMedics/Docs/.agent/rules/.test-evidence.md)

---

## License

Private and proprietary. All rights reserved.
