SET session_replication_role = 'replica';
\i migrate_data.sql
SET session_replication_role = 'origin';
