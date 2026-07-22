/**
 * pre-deploy-check.js
 * ---------------------------------------------------------------------
 * ?????? ??? ?? ??? ??????? ?????? ?? ???? ???????.
 * Run before every production deployment to verify migration safety.
 *
 * Usage:
 *   node scripts/pre-deploy-check.js
 *
 * Exit code 0 = safe to deploy
 * Exit code 1 = issues found, DO NOT deploy
 */

const fs = require("fs");
const path = require("path");

const RED    = "\x1b[31m";
const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE   = "\x1b[34m";
const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";

let hasErrors   = false;
let hasWarnings = false;

function pass(msg)  { console.log(`  ${GREEN}?${RESET}  ${msg}`); }
function fail(msg)  { console.log(`  ${RED}?${RESET}  ${msg}`); hasErrors = true; }
function warn(msg)  { console.log(`  ${YELLOW}?${RESET}  ${msg}`); hasWarnings = true; }
function info(msg)  { console.log(`  ${BLUE}?${RESET}  ${msg}`); }
function section(t) { console.log(`\n${BOLD}${BLUE}-- ${t} --${RESET}`); }

// --- 1. Dangerous SQL patterns in pending migrations ------------------------
section("Checking Migration SQL for dangerous patterns");

const migrationsDir = path.join(__dirname, "..", "prisma", "migrations");
const dangerousPatterns = [
  { re: /^\s*DROP\s+TABLE/im,         label: "DROP TABLE" },
  { re: /^\s*DROP\s+COLUMN/im,        label: "DROP COLUMN" },
  { re: /^\s*TRUNCATE/im,             label: "TRUNCATE" },
  { re: /SET\s+NOT\s+NULL/im,         label: "SET NOT NULL on existing column (check for NULLs first)" },
  { re: /ALTER\s+COLUMN.+TYPE/im,     label: "ALTER COLUMN TYPE (may fail on existing data)" },
];

if (fs.existsSync(migrationsDir)) {
  const dirs = fs.readdirSync(migrationsDir)
    .filter(d => fs.statSync(path.join(migrationsDir, d)).isDirectory())
    .sort();

  dirs.forEach(dir => {
    const sqlFile = path.join(migrationsDir, dir, "migration.sql");
    if (!fs.existsSync(sqlFile)) return;
    const sql = fs.readFileSync(sqlFile, "utf8");
    let migrationHasDanger = false;
    dangerousPatterns.forEach(({ re, label }) => {
      if (re.test(sql)) {
        warn(`[${dir}] Contains: ${label}`);
        migrationHasDanger = true;
      }
    });
    if (!migrationHasDanger) {
      pass(`[${dir}] � no dangerous patterns`);
    }
  });
} else {
  info("No migrations directory found.");
}

// --- 2. Check that NODE_ENV is not 'production' locally ---------------------
section("Checking Environment");

const nodeEnv = process.env.NODE_ENV || "development";
if (nodeEnv === "production") {
  fail("NODE_ENV=production on local machine � running this check in the WRONG environment?");
} else {
  pass(`NODE_ENV=${nodeEnv} (correct for local check)`);
}

// --- 3. Check required .env variables are documented ------------------------
section("Checking .env.example completeness");

const envExamplePath = path.join(__dirname, "..", ".env.example");
const envPath        = path.join(__dirname, "..", ".env");

if (!fs.existsSync(envExamplePath)) {
  warn(".env.example not found � create it to document required variables");
} else {
  pass(".env.example exists");
  if (fs.existsSync(envPath)) {
    const exampleKeys = fs.readFileSync(envExamplePath, "utf8")
      .split("\n")
      .filter(l => l.includes("=") && !l.startsWith("#"))
      .map(l => l.split("=")[0].trim());
    const envKeys = fs.readFileSync(envPath, "utf8")
      .split("\n")
      .filter(l => l.includes("=") && !l.startsWith("#"))
      .map(l => l.split("=")[0].trim());
    const missing = exampleKeys.filter(k => !envKeys.includes(k));
    if (missing.length > 0) {
      missing.forEach(k => warn(`Missing in .env: ${k}`));
    } else {
      pass("All .env.example keys present in .env");
    }
  }
}

// --- 4. Check CHANGELOG.md is updated ---------------------------------------
section("Checking CHANGELOG.md");

const changelogPath = path.join(__dirname, "..", "..", "CHANGELOG.md");
if (!fs.existsSync(changelogPath)) {
  warn("CHANGELOG.md not found � please create and document changes before deploying");
} else {
  const changelog = fs.readFileSync(changelogPath, "utf8");
  const today = new Date().toISOString().slice(0, 10);
  if (changelog.includes("[Unreleased]") && changelog.includes("## [Unreleased]\n> ????????? ??? ???????")) {
    warn("CHANGELOG.md has unreleased changes � did you move them to a version section?");
  } else {
    pass("CHANGELOG.md exists");
  }
}

// --- 5. Check bypass emails not in production code --------------------------
section("Checking for hard-coded bypass emails (A1 check)");

const controllersDir = path.join(__dirname, "..", "controllers");
const bypassEmails = ["@system.com", "al3ren0@gmail.com"];
const filesToCheck = fs.readdirSync(controllersDir)
  .filter(f => f.endsWith(".js"))
  .map(f => path.join(controllersDir, f));

let bypassFound = false;
filesToCheck.forEach(filePath => {
  const content = fs.readFileSync(filePath, "utf8");
  bypassEmails.forEach(email => {
    if (content.includes(email)) {
      const filename = path.basename(filePath);
      fail(`Hard-coded bypass email "${email}" found in ${filename} � REMOVE before deploying to production!`);
      bypassFound = true;
    }
  });
});
if (!bypassFound) {
  pass("No hard-coded bypass emails found in controllers");
}

// --- 6. Check OTP testCode not unconditionally exposed ----------------------
section("Checking OTP production safety (A2 check)");

const authFile = path.join(__dirname, "..", "controllers", "authController.js");
if (fs.existsSync(authFile)) {
  const content = fs.readFileSync(authFile, "utf8");
  if (/isBypassEmail/.test(content)) {
    fail("authController.js: isBypassEmail OTP bypass is still present � remove before production!");
  } else if (/response\.testCode/.test(content)) {
    if (/NODE_ENV.*production/.test(content) || /!isProd/.test(content)) {
      pass("OTP testCode is guarded by NODE_ENV check");
    } else {
      fail("OTP testCode may be exposed without NODE_ENV guard � review authController.js");
    }
  } else {
    pass("No unconditional OTP testCode exposure found");
  }
}


// --- 7. Verify a recent backup exists before deploying ----------------------
const SECTION_BACKUP = "Verifying recent backup exists";
console.log("\n" + "-- " + SECTION_BACKUP + " --");

const backupsDir   = path.join(__dirname, "..", "backups");
const lastBkpFile  = path.join(backupsDir, ".last_backup");

if (!fs.existsSync(backupsDir) || fs.readdirSync(backupsDir).filter(f => f.endsWith(".json.gz")).length === 0) {
  fail("No backups found! Run: npm run db:backup -- before deploying to production.");
} else {
  const archives = fs.readdirSync(backupsDir).filter(f => f.endsWith(".json.gz")).sort();
  const latest   = archives[archives.length - 1];
  const latestPath = path.join(backupsDir, latest);
  const ageMins  = (Date.now() - fs.statSync(latestPath).mtimeMs) / 60000;

  if (ageMins > 60) {
    warn(`Latest backup is ${Math.round(ageMins)} minutes old: ${latest}`);
    warn("Consider running: npm run db:backup -- to get a fresh backup before deploying.");
  } else {
    pass(`Recent backup found (${Math.round(ageMins)} min ago): ${latest}`);
  }
}

// --- Summary -----------------------------------------------------------------
console.log("\n" + "-".repeat(55));
if (hasErrors) {
  console.log(`\n${RED}${BOLD}?  DEPLOYMENT BLOCKED � Fix the issues above first.${RESET}`);
  console.log(`${RED}    ?? ???? ??????? ??? ?? ??????? ???????? ?????.${RESET}\n`);
  process.exit(1);
} else if (hasWarnings) {
  console.log(`\n${YELLOW}${BOLD}??  Warnings found � review them before deploying.${RESET}`);
  console.log(`${YELLOW}   ???? ????????? ????? ??? ?????.${RESET}\n`);
  process.exit(0);
} else {
  console.log(`\n${GREEN}${BOLD}?  All checks passed � safe to deploy!${RESET}`);
  console.log(`${GREEN}   ???? ???????? ????? � ??? ????? ???????.${RESET}\n`);
  process.exit(0);
}

