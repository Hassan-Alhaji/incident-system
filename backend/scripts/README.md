# Backend Maintenance and Testing Scripts

This directory contains various one-off scripts, data migration utilities, database seeders, and test files that were used during the development and testing phases of the Incident Management System.

## Contents
- `_fix_*.cjs` / `fix_*.js`: Scripts used to patch production data (e.g. RCA states, encoding issues).
- `test_*.js` / `check_*.js`: Ad-hoc testing scripts for AI integration, Database connection, Password hashing, SMTP, and PDF generation.
- `seed*.js`: Database seeders for injecting fake tickets, marshals, and local test data.
- `copy_*.js` / `migrate_*.js`: Scripts used for copying master data and migrating between different database environments.
- `*.sql`: SQL dumps and truncation scripts used for direct database manipulation.
- `*.pdf`: Output PDFs generated during PDF rendering tests.

## Note
These scripts are not loaded by the main application (`server.js`) and are safe to keep here for historical reference. DO NOT run these scripts in a production environment without reviewing the code first, as many of them contain hardcoded database manipulations or `truncate` commands.
