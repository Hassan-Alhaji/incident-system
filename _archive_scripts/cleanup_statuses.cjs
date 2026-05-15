const fs = require('fs');

// 1. schema.prisma
let s = fs.readFileSync('backend/prisma/schema.prisma', 'utf8');
s = s.replace(/\s*ASSIGNED_TO_HR[^\n]*\n/g, '\n');
s = s.replace(/\s*HR_COMPLETED[^\n]*\n/g, '\n');
s = s.replace(/\s*UNDER_INVESTIGATION[^\n]*\n/g, '\n');
fs.writeFileSync('backend/prisma/schema.prisma', s);

// 2. ticketWorkflow.js (remove PROCEED_RCA and submitRCA backend routes entirely, and ASSIGNED_TO_HR in actionPlan if any)
let tw = fs.readFileSync('backend/controllers/ticketWorkflow.js', 'utf8');
tw = tw.replace(/if \(action === 'PROCEED_RCA'\) \{[\s\S]+?return res\.json\(\{ message: 'Moved to RCA', status: 'UNDER_INVESTIGATION' \}\);\s*\}/, '');
tw = tw.replace(/const submitRCA = async[\s\S]+?};/m, ''); // submitRCA logic
// Also fix line 251 if it wasn't replaced earlier properly? wait, update_workflow2.cjs was supposed to fix it. Let's force replace ASSIGNED_TO_HR just in case:
tw = tw.replace(/const newStatus = isHRTicket \? 'ASSIGNED_TO_HR' : 'RETURNED_TO_DEPARTMENT';/, "const newStatus = 'RETURNED_TO_DEPARTMENT';");
fs.writeFileSync('backend/controllers/ticketWorkflow.js', tw);

// 3. actionPlanController.js
let ap = fs.readFileSync('backend/controllers/actionPlanController.js', 'utf8');
ap = ap.replace(/'ASSIGNED_TO_HR',?/g, '');
fs.writeFileSync('backend/controllers/actionPlanController.js', ap);

// 4. TicketSections.tsx
let ts = fs.readFileSync('frontend/src/components/TicketSections.tsx', 'utf8');
ts = ts.replace(/'ASSIGNED_TO_HR',\s*/g, '');
ts = ts.replace(/isControllerRole && ticket\.status === 'UNDER_INVESTIGATION'/g, "false /* Legacy */");
fs.writeFileSync('frontend/src/components/TicketSections.tsx', ts);

// 5. Dashboard.tsx
let db = fs.readFileSync('frontend/src/pages/Dashboard.tsx', 'utf8');
db = db.replace(/\s*UNDER_INVESTIGATION:\s*\{[^\}]+\},/g, '');
db = db.replace(/const investigCount = [^;]+;/g, "const investigCount = 0;");
db = db.replace(/'UNDER_INVESTIGATION',\s*/g, '');
fs.writeFileSync('frontend/src/pages/Dashboard.tsx', db);

// 6. statusConfig.ts
let sc = fs.readFileSync('frontend/src/utils/statusConfig.ts', 'utf8');
sc = sc.replace(/\s*ASSIGNED_TO_HR:[^\n]*\n/g, '\n');
sc = sc.replace(/\s*UNDER_INVESTIGATION:[^\n]*\n/g, '\n');
fs.writeFileSync('frontend/src/utils/statusConfig.ts', sc);

console.log("Cleanup done.");
