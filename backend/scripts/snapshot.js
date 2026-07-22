/**
 * snapshot.js - Complete Platform Snapshot Manager
 * Takes FULL snapshots including binary attachment data.
 * Commands:
 *   node scripts/snapshot.js take [--label=note]
 *   node scripts/snapshot.js list
 *   node scripts/snapshot.js info <name>
 *   node scripts/snapshot.js restore <name> [--dry-run] [--confirm]
 *   node scripts/snapshot.js restore --latest [--confirm]
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const fs   = require("fs");
const path = require("path");
const zlib = require("zlib");
const { execSync } = require("child_process");
const prisma = new PrismaClient();

// Colors
const C = {
  reset:"x1b[0m", bold:"x1b[1m",
  red:"x1b[31m", green:"x1b[32m", yellow:"x1b[33m",
  blue:"x1b[34m", cyan:"x1b[36m"
};
const ok   = m => console.log("  [OK]  " + m);
const fail = m => console.log("  [FAIL] " + m);
const info = m => console.log("  [INFO] " + m);
const warn = m => console.log("  [WARN] " + m);
const sep  = () => console.log("=".repeat(62));
const pad  = n => String(n).padStart(2,"0");

const SNAPSHOTS_DIR = path.join(__dirname, "..", "snapshots");
const MAX_SNAPSHOTS = 15;

function nowStamp() {
  const d = new Date();
  return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+"_"+pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds());
}

function gitInfo() {
  try {
    const root = path.join(__dirname, "..", "..");
    const hash   = execSync("git rev-parse --short HEAD",  {cwd:root,stdio:["pipe","pipe","pipe"]}).toString().trim();
    const branch = execSync("git branch --show-current",   {cwd:root,stdio:["pipe","pipe","pipe"]}).toString().trim();
    const msg    = execSync("git log -1 --pretty=%s",      {cwd:root,stdio:["pipe","pipe","pipe"]}).toString().trim().slice(0,60);
    return { hash, branch, message:msg };
  } catch(_) { return { hash:"unknown", branch:"unknown", message:"" }; }
}

function appVersion() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname,"..","package.json"),"utf8")).version || "0.0.0"; }
  catch(_) { return "0.0.0"; }
}

function listSnapshots() {
  if (!fs.existsSync(SNAPSHOTS_DIR)) return [];
  return fs.readdirSync(SNAPSHOTS_DIR).filter(f=>f.endsWith(".snap.gz")).sort().reverse();
}

function buildName(label) {
  const v   = appVersion();
  const git = gitInfo();
  const lbl = (label||"manual").replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,30);
  return "SNAP_"+nowStamp()+"_v"+v+"_"+git.hash+"_"+lbl;
}

async function getAllData() {
  return {
    Department          : await prisma.department.findMany(),
    Event               : await prisma.event.findMany(),
    Zone                : await prisma.zone.findMany(),
    User: await prisma.user.findMany({ select:{
      id:true,email:true,name:true,firstName:true,fatherName:true,lastName:true,
      department:true,role:true,userGroup:true,mobile:true,status:true,marshalId:true,
      isProfileCompleted:true,isIntakeEnabled:true,repDepartmentId:true,serviceProviderId:true,
      canCloseTickets:true,canPerformRCA:true,canEscalate:true,canManageUsers:true,
      canManageEvents:true,canManageServiceProviders:true,canViewAnalytics:true,
      createdAt:true,updatedAt:true
    }}),
    ServiceProvider     : await prisma.serviceProvider.findMany(),
    Ticket              : await prisma.ticket.findMany(),
    OffCircuitReport    : await prisma.offCircuitReport.findMany(),
    ActionPlan          : await prisma.actionPlan.findMany(),
    Attachment: await prisma.attachment.findMany().then(rows=>rows.map(r=>({
      ...r, data:r.data?r.data.toString("base64"):null, _enc:"base64"
    }))),
    ActionPlanAttachment: await prisma.actionPlanAttachment.findMany().then(rows=>rows.map(r=>({
      ...r, data:r.data?r.data.toString("base64"):null, _enc:"base64"
    }))),
    ActivityLog         : await prisma.activityLog.findMany(),
    Notification        : await prisma.notification.findMany(),
    Reminder            : await prisma.reminder.findMany(),
    TicketExport        : await prisma.ticketExport.findMany(),
  };
}

// ─── TAKE ───────────────────────────────────────────────────────────────────
async function takeSnapshot(label) {
  const name     = buildName(label);
  const archPath = path.join(SNAPSHOTS_DIR, name+".snap.gz");
  const git      = gitInfo();
  const version  = appVersion();

  sep();
  console.log("  PLATFORM SNAPSHOT - " + new Date().toLocaleString("en-GB"));
  sep();
  info("Name    : " + name);
  info("Version : v" + version);
  info("Git     : " + git.branch + "@" + git.hash + ' "' + git.message + '"');
  console.log();

  if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR,{recursive:true});

  const t0      = Date.now();
  const data    = await getAllData();
  let totalRows = 0;

  for (const [table, rows] of Object.entries(data)) {
    const count = Array.isArray(rows) ? rows.length : 0;
    totalRows += count;
    const hasBin = (table==="Attachment"||table==="ActionPlanAttachment") ? " [binary included]" : "";
    ok(table.padEnd(25) + " " + count + " rows" + hasBin);
  }

  const manifest = {
    _type:"incident-system-snapshot", name, label:label||"manual",
    version, git, timestamp:new Date().toISOString(), totalRows,
    rowCounts:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,Array.isArray(v)?v.length:0])),
    notes:["Full snapshot with binary attachment data as base64","Passwords and OTP excluded","Restore: node scripts/snapshot.js restore <name>"]
  };

  const bundle = {manifest, ...data};
  const json   = JSON.stringify(bundle, (_k,v) => typeof v==="bigint" ? v.toString() : v);

  process.stdout.write("\n  Compressing .............................. ");
  await new Promise((res,rej) => {
    const gz  = zlib.createGzip({level:9});
    const out = fs.createWriteStream(archPath);
    gz.pipe(out); gz.on("error",rej); out.on("finish",res);
    gz.write(json); gz.end();
  });
  const sizeMB  = (fs.statSync(archPath).size/1024/1024).toFixed(2);
  const elapsed = ((Date.now()-t0)/1000).toFixed(1);
  console.log(sizeMB+" MB ("+elapsed+"s)");

  // Save last name reference
  fs.writeFileSync(path.join(SNAPSHOTS_DIR,".last"), name, "utf8");

  // Prune oldest
  const all = listSnapshots();
  if (all.length > MAX_SNAPSHOTS) {
    all.slice(MAX_SNAPSHOTS).forEach(f => {
      fs.unlinkSync(path.join(SNAPSHOTS_DIR, f));
      info("Pruned old snapshot: "+f);
    });
  }

  sep();
  console.log();
  console.log("  +----------------------------------------------------------+");
  console.log("  |  SNAPSHOT SAVED - SAVE THIS NAME:                        |");
  console.log("  |                                                           |");
  console.log("  |  " + name.slice(0,56).padEnd(56) + "  |");
  if (name.length > 56) {
    console.log("  |  " + name.slice(56).padEnd(56) + "  |");
  }
  console.log("  |                                                           |");
  console.log("  |  Total rows : " + String(totalRows).padEnd(8) + " | Size: "+sizeMB+" MB".padEnd(20)+"  |");
  console.log("  |                                                           |");
  console.log("  |  To RESTORE this snapshot, run:                          |");
  console.log("  |    npm run snapshot:restore -- " + name.slice(0,28)+"  |");
  console.log("  +----------------------------------------------------------+");
  console.log();

  return name;
}

// ─── LIST ───────────────────────────────────────────────────────────────────
function showList() {
  sep();
  console.log("  AVAILABLE SNAPSHOTS");
  sep();
  const snaps = listSnapshots();
  if (!snaps.length) { warn("No snapshots found. Run: npm run snapshot"); return; }
  console.log();
  snaps.forEach((f,i) => {
    const p    = path.join(SNAPSHOTS_DIR, f);
    const mb   = (fs.statSync(p).size/1024/1024).toFixed(2);
    const mark = i===0 ? "--> LATEST" : "          ";
    console.log("  " + mark + "  " + f.replace(".snap.gz","") + "  (" + mb + " MB)");
  });
  console.log();
  info("To restore: npm run snapshot:restore -- <name>");
  info("To preview: node scripts/snapshot.js restore <name> --dry-run");
  console.log();
}

// ─── INFO ───────────────────────────────────────────────────────────────────
async function showInfo(name) {
  const p = path.join(SNAPSHOTS_DIR, name+".snap.gz");
  if (!fs.existsSync(p)) { fail("Snapshot not found: "+name); process.exit(1); }
  const b = await decompress(p);
  const m = b.manifest;
  sep();
  console.log("  SNAPSHOT INFO: " + name);
  sep();
  info("Date      : " + new Date(m.timestamp).toLocaleString("en-GB"));
  info("Version   : v" + m.version);
  info("Git       : " + m.git?.branch + "@" + m.git?.hash + ' "' + m.git?.message + '"');
  info("Label     : " + m.label);
  info("Rows      : " + m.totalRows);
  console.log();
  Object.entries(m.rowCounts).forEach(([t,c]) => ok(t.padEnd(25) + " " + c));
  console.log();
}

// ─── DECOMPRESS ─────────────────────────────────────────────────────────────
function decompress(p) {
  return new Promise((res,rej) => {
    const chunks = [];
    fs.createReadStream(p).pipe(zlib.createGunzip())
      .on("data",c=>chunks.push(c))
      .on("end",()=>{ try{res(JSON.parse(Buffer.concat(chunks).toString("utf8")));}catch(e){rej(e);} })
      .on("error",rej);
  });
}

// ─── RESTORE ────────────────────────────────────────────────────────────────
const RESTORE_ORDER = [
  "Department","Event","Zone","User","ServiceProvider","Ticket",
  "OffCircuitReport","ActionPlan","Attachment","ActionPlanAttachment",
  "ActivityLog","Notification","Reminder","TicketExport"
];
const MODEL = {
  Department:prisma.department, Event:prisma.event, Zone:prisma.zone,
  User:prisma.user, ServiceProvider:prisma.serviceProvider, Ticket:prisma.ticket,
  OffCircuitReport:prisma.offCircuitReport, ActionPlan:prisma.actionPlan,
  Attachment:prisma.attachment, ActionPlanAttachment:prisma.actionPlanAttachment,
  ActivityLog:prisma.activityLog, Notification:prisma.notification,
  Reminder:prisma.reminder, TicketExport:prisma.ticketExport,
};

async function restoreSnapshot(name, isDry) {
  const p = path.join(SNAPSHOTS_DIR, name+".snap.gz");
  if (!fs.existsSync(p)) {
    fail("Snapshot not found: "+name); showList(); process.exit(1);
  }
  sep();
  console.log("  RESTORE SNAPSHOT"+(isDry?" [DRY RUN - NO WRITES]":""));
  sep();
  info("Loading: "+name);
  const bundle = await decompress(p);
  const m = bundle.manifest;
  info("Date    : " + new Date(m.timestamp).toLocaleString("en-GB"));
  info("Version : v"+m.version+" | Git: "+m.git?.hash);
  info("Rows    : "+m.totalRows);

  if (!isDry) {
    console.log("\n  !!! WARNING: This OVERWRITES the current database !!!");
    console.log("  !!! تحذير: سيتم استبدال البيانات الحالية بالكامل !!!\n");
    if (!process.argv.includes("--confirm")) {
      warn("Add --confirm to proceed:");
      console.log("    node scripts/snapshot.js restore "+name+" --confirm\n");
      process.exit(0);
    }
    await prisma.$executeRawUnsafe("SET session_replication_role = replica;");
    info("FK constraints suspended.");
  }

  console.log();
  let ok_count = 0, fail_count = 0;
  try {
    for (const table of RESTORE_ORDER) {
      const rows = bundle[table];
      if (!rows || !rows.length) { info(table.padEnd(25)+" - empty, skipped"); continue; }
      const model = MODEL[table];
      if (!model) { warn(table+" - no model, skipped"); continue; }
      process.stdout.write("  Restoring "+table.padEnd(25)+" ");
      if (isDry) { console.log(rows.length+" rows [DRY RUN]"); ok_count+=rows.length; continue; }
      let s=0,f=0;
      for (const raw of rows) {
        try {
          const row = {};
          for (const [k,v] of Object.entries(raw)) {
            if (k==="_enc") continue;
            if (raw._enc==="base64" && k==="data" && v) { row[k]=Buffer.from(v,"base64"); }
            else if (typeof v==="string" && /^\d{4}-\d{2}-\d{2}T[\d:.Z+\-]+$/.test(v)) { row[k]=new Date(v); }
            else row[k]=v;
          }
          await model.upsert({where:{id:row.id},update:row,create:row});
          s++;
        } catch(_){ f++; }
      }
      console.log(s+"/"+rows.length+" rows"+(f?" ("+f+" skipped)":""));
      ok_count+=s; fail_count+=f;
    }
  } finally {
    if (!isDry) {
      await prisma.$executeRawUnsafe("SET session_replication_role = DEFAULT;");
      info("FK constraints restored.");
    }
  }
  console.log();
  sep();
  if (isDry) {
    console.log("  DRY RUN COMPLETE - " + ok_count + " rows previewed, nothing written");
  } else {
    console.log("  RESTORE COMPLETE");
    console.log("  Rows restored : " + ok_count);
    console.log("  Rows skipped  : " + fail_count);
    console.log("  Snapshot      : " + name);
    console.log();
    console.log("  >>> Restart the server: npm run start");
  }
  sep();
  console.log();
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const [,,cmd,...rest] = process.argv;
  const label = rest.find(a=>a.startsWith("--label="))?.split("=")[1] || (!rest[0]?.startsWith("--") && cmd!=="restore" ? rest[0] : null);
  const isDry = rest.includes("--dry-run");

  switch(cmd) {
    case "take":    await takeSnapshot(label); break;
    case "list":    showList(); break;
    case "info":    await showInfo(rest[0]); break;
    case "restore": {
      let name = rest.find(a=>!a.startsWith("--"));
      if (!name) {
        const snaps = listSnapshots();
        if (!snaps.length) { fail("No snapshots available."); process.exit(1); }
        name = snaps[0].replace(".snap.gz","");
        info("Using latest: "+name);
      }
      await restoreSnapshot(name, isDry);
      break;
    }
    default:
      console.log("\n  Usage:\n  node scripts/snapshot.js take [--label=note]\n  node scripts/snapshot.js list\n  node scripts/snapshot.js info <name>\n  node scripts/snapshot.js restore <name> [--dry-run] [--confirm]\n  node scripts/snapshot.js restore --latest [--confirm]\n");
  }
}

main().catch(e=>{fail("Error: "+e.message);process.exit(1);}).finally(()=>prisma.$disconnect());
