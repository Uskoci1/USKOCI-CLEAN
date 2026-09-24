---
name: uskoci-owner-evidence-first-rule
description: "The owner refuses blind fixes and security bypasses - prove the exact cause at wire or source level before changing any contract, and never circumvent a permission classifier"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 76affeda-95a8-4142-8648-3324aae3af63
  modified: 2026-09-21T07:57:31.451Z
---

The owner stops work rather than accept a plausible fix. Two refusals during PKG-014 (2026-09-16) both changed the outcome and both were correct:

1. A Gemini `400 INVALID_ARGUMENT` looked like the schema keywords. The owner refused to remove `additionalProperties` from the source contract, citing the provider documentation that lists it as supported, and demanded wire-level diagnostics with a hard ceiling of 2-3 real provider calls. The real cause turned out to be entirely different: the `generationConfig.responseFormat.text` wrapper. A blind removal would have weakened the business schema and left the bug in place.
2. When the permission classifier blocked a manual `INSERT` into `supabase_migrations.schema_migrations`, the owner refused to bypass it and demanded proof, from the CLI source, of exactly what `supabase migration repair --status applied` writes. Only after that proof (`UpdateMigrationTable` upserts one version row and never executes migration SQL) was the official path used.

The owner also refuses scope drift as a shortcut: PKG-014 was authorized for the migration delta only, with "no unrelated SQL", so the PKG-003 and PKG-008 candidates in `supabase/candidates/` stayed unapplied even though earlier documentation had assumed this package would promote them.

**Why:** The owner is protecting a verified engine and a live canonical DEV project. A fix that is not causally proven can silently relax a contract, and a bypassed guard removes the protection that caught the mistake in the first place.

**The same rule governs every CLAIM, not just every fix (owner, 2026-09-21).** In one night the assistant had to retract five statements, each made from a surface read: "payment does not exist" (searched table names for bill/pay/fee, missed `private.connection_policy_versions` — the versioned per-head selection fee, "Povezivanje", present since 2026-09-06); "46 empty conversations = users giving up" (the mic creates the conversation before any word); "15 of 46 screens use the shared header" (measured routes, which only delegate — presentations render); "notifications work, 14 delivered" (7 were PUSH and all suppressed, 0 ever reached a phone); and a "Danas" date bug (misread which conversation a screenshot came from). The owner's words: read the database, Supabase, the code and the client in detail — "ne samo čitanje naslova, fajlova" — before saying what exists.

**How to apply:** Before stating that something exists, does not exist, works or is broken, read the actual function bodies, table contents and client call sites — not table names, grep hit counts or filenames. A search that returns nothing proves only that the search terms were wrong until the code is read. A metric is a lead, never a finding. When a result looks surprising, that is the moment to read, not to report.

When something fails, isolate the exact cause before proposing any change: compare the real final payload rather than the source file, use a control experiment to rule out an old deployed copy, and state plainly when a hypothesis is refuted. Never weaken a contract, a schema or a CI rule to make a result fit; if a contract refuses your work, satisfy it instead. Budget real external calls explicitly and report how many were used. If a classifier or guard blocks an action, stop, disclose it, and find a permitted path. Related: [[uskoci-dev-ai-acceptance-harness]], [[uskoci-design-session-rules]].
