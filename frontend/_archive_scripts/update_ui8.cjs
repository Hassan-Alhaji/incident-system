const fs = require('fs');
let c = fs.readFileSync('src/pages/TicketDetail.tsx', 'utf8');

// Replace the routing buttons
const regexButtons = /\{hasEmployeeInjury \? \([\s\S]+?\) : \([\s\S]+?<button[\s\S]+?onClick=\{[\s\S]+?'ASSIGN'[\s\S]+?<\/button>\s*\)\}/m;

const replacementButtons = `<button
                                                onClick={() => { if (!severityLevel || !targetDepartmentId || !controllerNotes.trim()) return; const deptName = departments.find(d => d.id === targetDepartmentId)?.name || targetDepartmentId; confirmThen(() => handleControllerAction('ASSIGN'), isRtl ? 'اعتماد وتوجيه' : 'Approve & Route', isRtl ? \`سيتم التوجيه إلى "\${deptName}" بتصنيف "\${severityLevel}".\` : \`Routing to "\${deptName}" with severity "\${severityLevel}".\`, 'primary'); }}
                                                disabled={actionLoading || !targetDepartmentId || !severityLevel || !controllerNotes.trim()}
                                                className="bg-blue-600 text-white py-2.5 px-3 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-blue-700 flex items-center justify-center gap-1.5"
                                            >✓ {t('ticketActions.assign', 'اعتماد وتوجيه')}</button>`;

c = c.replace(regexButtons, replacementButtons);

// Remove the waiting for HR block
const regexWaitingHR = /\{\/\* CONTROLLER: WAITING for HR - status info banner \*\/\}[\s\S]+?<\/div>\s*\)\}/m;
c = c.replace(regexWaitingHR, '');

fs.writeFileSync('src/pages/TicketDetail.tsx', c);
