const fs = require('fs');
let c = fs.readFileSync('controllers/ocTicketController.js', 'utf8');

// Inside `const hseControllerAction`:
// Need to extract `targetDepartmentId` from req.body
const extractionRegex = /isLTI, isMaterialDamage, isRegulatoryReportable, isNearMiss,\s*riskLikelihood, riskConsequence, riskScore, riskLevel\s*\} = req.body;/;
c = c.replace(extractionRegex, `isLTI, isMaterialDamage, isRegulatoryReportable, isNearMiss,
            riskLikelihood, riskConsequence, riskScore, riskLevel,
            targetDepartmentId
        } = req.body;`);

// Replace ROUTE_DEP_REP
const oldRouteDepRep = `if (action === 'ROUTE_DEP_REP') {
            // Must have service provider or direct routing
            if (serviceProviderId) {
                await prisma.ticket.update({ where: { id: ticket.id }, data: { serviceProviderId } });
            }
            await prisma.ticket.update({
                where: { id: ticket.id },
                data: {
                    ...baseUpdateData,
                    offCircuitReport: { update: controllerAssessmentData },
                    status: 'PENDING_DEP_REP',
                    escalatedToRole: 'DEP_REP',
                    activityLogs: { create: { actorId: req.user.id, action: 'ROUTED_TO_DEP_REP', details: \`Corrective Action Plan required: \${notes}\` } }
                }
            });
            return res.json({ message: 'Routed to Department Rep' });
        }`;

const newRouteDepRep = `if (action === 'ROUTE_DEP_REP') {
            if (targetDepartmentId === 'HSE_MANAGER') {
                await prisma.ticket.update({
                    where: { id: ticket.id },
                    data: {
                        ...baseUpdateData,
                        offCircuitReport: { update: controllerAssessmentData },
                        status: 'FINAL_REVIEW',
                        escalatedToRole: 'OC_HSE_MANAGER',
                        activityLogs: { create: { actorId: req.user.id, action: 'ROUTED_TO_HSE_MANAGER', details: \`Passed to HSE Manager: \${notes}\` } }
                    }
                });
                return res.json({ message: 'Routed to HSE Manager successfully' });
            }

            // Normal Department Routing
            const extraData = {};
            if (targetDepartmentId && targetDepartmentId !== 'HSE_MANAGER') {
                extraData.departmentId = targetDepartmentId;
            } else if (serviceProviderId) {
                extraData.serviceProviderId = serviceProviderId;
            }

            await prisma.ticket.update({
                where: { id: ticket.id },
                data: {
                    ...baseUpdateData,
                    ...extraData,
                    offCircuitReport: { update: controllerAssessmentData },
                    status: 'PENDING_DEP_REP',
                    escalatedToRole: 'DEP_REP',
                    activityLogs: { create: { actorId: req.user.id, action: 'ROUTED_TO_DEP_REP', details: \`Corrective Action Plan required: \${notes}\` } }
                }
            });
            return res.json({ message: 'Routed to Department Rep' });
        }`;

c = c.replace(oldRouteDepRep, newRouteDepRep);

fs.writeFileSync('controllers/ocTicketController.js', c);
console.log('Fixed ocTicketController logic');
