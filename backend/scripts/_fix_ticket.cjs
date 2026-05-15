const fs = require('fs');
let c = fs.readFileSync('controllers/ticketController.js', 'utf8');

const oldDepRepLogic = `} else if (OC_ROLES.DEP_REP.includes(role)) {
            where.OR = [
                { status: 'PENDING_DEP_REP' },
                { assignedToId: userId }
            ];`;

const newDepRepLogic = `} else if (OC_ROLES.DEP_REP.includes(role)) {
            const deptCondition = req.user.repDepartmentId ? {
                OR: [
                    { departmentId: req.user.repDepartmentId },
                    { serviceProvider: { responsibleDepartmentId: req.user.repDepartmentId } }
                ]
            } : { id: 'invalid_no_dept' };
            
            where.OR = [
                {
                    AND: [
                        { status: 'PENDING_DEP_REP' },
                        deptCondition
                    ]
                },
                { assignedToId: userId }
            ];`;

c = c.replace(oldDepRepLogic, newDepRepLogic);

const oldDepManagerLogic = `} else if (OC_ROLES.DEP_MANAGER.includes(role)) {
            where.OR = [
                { status: 'ESCALATED_TO_DEP_MANAGER' },
                { assignedToId: userId }
            ];`;

const newDepManagerLogic = `} else if (OC_ROLES.DEP_MANAGER.includes(role)) {
            const deptCondition = req.user.repDepartmentId ? {
                OR: [
                    { departmentId: req.user.repDepartmentId },
                    { serviceProvider: { responsibleDepartmentId: req.user.repDepartmentId } }
                ]
            } : { id: 'invalid_no_dept' };
            
            where.OR = [
                {
                    AND: [
                        { status: 'ESCALATED_TO_DEP_MANAGER' },
                        deptCondition
                    ]
                },
                { assignedToId: userId }
            ];`;

c = c.replace(oldDepManagerLogic, newDepManagerLogic);

fs.writeFileSync('controllers/ticketController.js', c);
console.log('Fixed ticketController logic');
