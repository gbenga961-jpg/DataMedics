# AGENTS.md

DataMedics is a web app that analyses CSV files for data-quality problems and cleans them under user control. This file is the entry point. It routes you to the right topic file and holds the hard doors. Detail lives in the topic files, not here.

## Where things live

- PRD path: `Docs/DataMedics_PRD_v1.5_Final.md`. Why: you cannot follow a document you cannot find. If this line still shows `<<FILL IN`, or no file exists at the path, stop and ask.
- The PRD and the files in the table below are the only rules sources. Why: guessing between sources hides conflicts.
  - If two sources conflict, stop and ask.
  - If a file in the table does not exist yet, tell the user, then follow the PRD section for that topic. If the PRD does not cover the task, stop and ask.
  - If a rules file appears that is not in the table, read it and tell the user so the table can be updated.

| If the task touches | Read first |
|---|---|
| Any code, any change | Docs/.agent/rules/.security.md, Docs/.agent/rules/.testing.md |
| Saying work is done, tested or passing | Docs/.agent/rules/.testing.md, then record in Docs/.agent/rules/.test-evidence.md |
| An open choice, a provider, a package, a test runner, a limit | Docs/.agent/rules/.decision.md |
| Folders, layers, stack, API routes, config | ARCHITECTURE.md (PRD §13) |
| Tables, Prisma, migrations | DATABASE.md (PRD §§15–17) |
| Upload validation, parsing, detection | CSV-ANALYSIS.md (PRD §§7–8) |
| Cleaning operations, cleaned output | CLEANING.md (PRD §9) |
| Spreadsheet-safe export, formula handling | EXPORT-SAFETY.md (PRD §§11–12, 18) |
| Queue, workers, retries, statuses | JOBS-AND-RELIABILITY.md (PRD §§16–17, 20) |
| Expiry, deletion, storage lifetime | RETENTION.md (PRD §21) |
| Pages, preview, messages, accessibility | UI.md (PRD §§5–6, 10, 22) |

## Database door

- Never run any command or code that connects to a database. This covers migrate, db push, db pull, studio, seed, reset, any query and any integration test. Why: only the user decides when data or schema changes.
- These do not connect and are allowed: `prisma generate`, `prisma validate`, `prisma format`, type-check, lint and unit tests. If you are unsure whether a command connects, do not run it. Ask. Why: a wrong guess touches real data.
- Edit `prisma/schema.prisma` or create migration files only when the user's request names that schema change. If a task needs a table or column change the request does not name, stop and ask. Why: a schema change is hard to undo once applied.

## Scope door

- Do not add, remove or change Version 1 scope. If a task needs it, stop and tell the user. Only the user can approve a scope change. Why: the Version 1 baseline is approved (PRD 31.3) and you cannot verify approval yourself.
- Do not build anything listed in PRD Section 29. Why: Version 2 must not delay Version 1.
- Do not build payment integration, subscription plans or commercial plan limits. Why: the business model is undecided (PRD 23).
- Operational abuse limits (for example upload size or request rate) are allowed, but only with values the PRD or DECISIONS.md states. If no value is stated, stop and ask. Why: an invented limit is a product rule.
- Do not build AI features. Why: PRD 22 defers them.

## Working rules

- Stop and ask when the PRD and these files do not state a product rule, limit, status, error code or data field that the task depends on. Why: an invented rule becomes a bug. Local names (variables, functions, components, CSS classes) and styling are your call.
- End every response with a heading "Assumptions" listing each other assumption you made. If there are none, write "Assumptions: none". Why: the user can then check each one.
- Do one task per request: the item the user named. If the request names several, do the first, list the rest as pending, and wait. Touch only the files that task needs. Why: small changes can be reviewed.
- Do not create or change code files until the user says the build stage has started. Before that you may read, review and answer questions. After it, build in the milestone order of PRD 28. Why: later milestones depend on earlier ones.
- Describe progress only in the words TESTING.md allows. Why: a false claim hides broken code.
