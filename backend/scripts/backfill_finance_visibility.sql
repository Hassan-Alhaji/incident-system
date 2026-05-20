-- ════════════════════════════════════════════════════════════════════════════
-- BACKFILL: Make previously-closed violation tickets visible to FINANCE_REP
-- ════════════════════════════════════════════════════════════════════════════
--
-- Context: Before today's fix, the closure flow silently overrode
-- violationType from FINANCIAL → NONE whenever an employee was injured,
-- which meant `forwardedToFinance` ended up false in the DB and the ticket
-- never appeared in the finance representative's list.
--
-- This script lets you:
--   • Identify candidates (Step 1)
--   • Backfill specific tickets with the correct violation amount (Step 2)
--   • Verify (Step 3)
--
-- ⚠️ RUN EACH STEP MANUALLY. Don't paste the whole file at once.
-- Each step is wrapped in a transaction so you can ROLLBACK if needed.
-- ════════════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────────
-- STEP 1 — INSPECT: List all CLOSED tickets NOT currently forwarded to finance.
-- Review the list, decide which ones had a real financial violation intent.
-- ────────────────────────────────────────────────────────────────────────────

SELECT
    t."ticketNo",
    t.status,
    t."hasInjury",
    t."hasFinancialViolation",
    t."forwardedToFinance",
    t."violationAmount",
    t."closureReason",
    t."violationDescription",
    t."closedAt",
    t."closedBy",
    sp.name        AS "serviceProvider",
    d.name         AS "responsibleDept"
FROM "Ticket" t
LEFT JOIN "ServiceProvider" sp ON sp.id = t."serviceProviderId"
LEFT JOIN "Department"      d  ON d.id  = t."departmentId"
WHERE t.status = 'CLOSED'
  AND COALESCE(t."forwardedToFinance", false) = false
ORDER BY t."closedAt" DESC NULLS LAST;


-- ────────────────────────────────────────────────────────────────────────────
-- STEP 2 — BACKFILL a single ticket (repeat for each one that needs it).
--
-- Replace:
--   <TICKET_NO>          → e.g. 'INC-2026-00045'
--   <AMOUNT_SAR>         → e.g. '6000'  (string, the schema stores it as text)
--   <DESCRIPTION>        → e.g. 'مخالفة سلامة — تم تطبيق غرامة'
--
-- The transaction ensures partial failure rolls back cleanly.
-- ────────────────────────────────────────────────────────────────────────────

-- BEGIN;
--
-- UPDATE "Ticket"
-- SET "hasFinancialViolation" = true,
--     "forwardedToFinance"    = true,
--     "violationAmount"       = '<AMOUNT_SAR>',
--     "violationDescription"  = COALESCE("violationDescription", '<DESCRIPTION>')
-- WHERE "ticketNo" = '<TICKET_NO>'
--   AND status = 'CLOSED';
--
-- -- Verify exactly 1 row updated before committing:
-- SELECT "ticketNo", "violationAmount", "forwardedToFinance", "hasFinancialViolation"
-- FROM "Ticket" WHERE "ticketNo" = '<TICKET_NO>';
--
-- COMMIT;  -- or ROLLBACK; if anything looks wrong


-- ────────────────────────────────────────────────────────────────────────────
-- STEP 2.1 — READY-TO-RUN EXAMPLE for INC-2026-00045 (6000 SAR)
-- Uncomment the block below to run as-is.
-- ────────────────────────────────────────────────────────────────────────────

-- BEGIN;
--
-- UPDATE "Ticket"
-- SET "hasFinancialViolation" = true,
--     "forwardedToFinance"    = true,
--     "violationAmount"       = '6000',
--     "violationDescription"  = COALESCE(
--                                  "violationDescription",
--                                  'مخالفة مالية — backfill manual / migrated retroactively'
--                              )
-- WHERE "ticketNo" = 'INC-2026-00045'
--   AND status = 'CLOSED';
--
-- SELECT "ticketNo", "violationAmount", "forwardedToFinance", "hasFinancialViolation"
-- FROM "Ticket" WHERE "ticketNo" = 'INC-2026-00045';
--
-- COMMIT;


-- ────────────────────────────────────────────────────────────────────────────
-- STEP 3 — VERIFY: list all tickets now visible to finance reps.
-- ────────────────────────────────────────────────────────────────────────────

SELECT
    t."ticketNo",
    t."violationAmount",
    t."violationDescription",
    t."closedAt",
    sp.name AS "serviceProvider",
    d.name  AS "responsibleDept"
FROM "Ticket" t
LEFT JOIN "ServiceProvider" sp ON sp.id = t."serviceProviderId"
LEFT JOIN "Department"      d  ON d.id  = t."departmentId"
WHERE t."forwardedToFinance" = true
ORDER BY t."closedAt" DESC NULLS LAST;


-- ────────────────────────────────────────────────────────────────────────────
-- STEP 4 (optional) — AUDIT TRAIL: log who/when the backfill happened.
-- Adds an entry to the activity log for traceability.
-- ────────────────────────────────────────────────────────────────────────────

-- INSERT INTO "ActivityLog" (id, "ticketId", "actorId", action, details, "createdAt")
-- SELECT
--     gen_random_uuid(),
--     t.id,
--     (SELECT id FROM "User" WHERE role = 'ADMIN' AND status = 'ACTIVE' LIMIT 1),
--     'BACKFILL_FINANCE_VISIBILITY',
--     'Manually backfilled forwardedToFinance=true (retroactive)',
--     NOW()
-- FROM "Ticket" t
-- WHERE t."ticketNo" = 'INC-2026-00045';
