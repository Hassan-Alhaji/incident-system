-- Disable triggers to handle circular foreign keys
SET session_replication_role = 'replica';

-- Truncate all tables
TRUNCATE TABLE "ActionPlanAttachment" CASCADE;
TRUNCATE TABLE "Attachment" CASCADE;
TRUNCATE TABLE "ActivityLog" CASCADE;
TRUNCATE TABLE "Reminder" CASCADE;
TRUNCATE TABLE "ActionPlan" CASCADE;
TRUNCATE TABLE "OffCircuitReport" CASCADE;
TRUNCATE TABLE "Notification" CASCADE;
TRUNCATE TABLE "Event" CASCADE;
TRUNCATE TABLE "Ticket" CASCADE;
TRUNCATE TABLE "User" CASCADE;
TRUNCATE TABLE "ServiceProvider" CASCADE;
TRUNCATE TABLE "Department" CASCADE;
TRUNCATE TABLE "Zone" CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';
