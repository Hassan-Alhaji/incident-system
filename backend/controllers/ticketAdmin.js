const prisma = require('../prismaClient');
const xlsx = require('xlsx');
const fs = require('fs');
const { ROLES, ADMIN_ROLES } = require('./ticketCrud');
const logger = require('../lib/logger').child({ module: 'ticketAdmin' });

const OC_USER_ROLES = ['OC_REPORTER','HSE_CONTROLLER','DEP_REP','DEP_MANAGER','SAFETY_MANAGER','OC_HSE_MANAGER','HR_REP','SERVICE_PROVIDER_REP','FINANCE_REP'];

/**
 * H5 — Excel Formula Injection prevention (OWASP CSV Injection Cheat Sheet).
 * Any cell that begins with `=`, `+`, `-`, `@`, TAB, or CR can be interpreted
 * by Excel/LibreOffice as a live formula, leading to DDE/HYPERLINK/WEBSERVICE
 * attacks against whoever opens the exported file. Prefix such values with a
 * single quote to force literal-text rendering.
 *
 * Applied at serialization time only — DB values remain untouched.
 */
const DANGEROUS_CELL_PREFIX = /^[=+\-@\t\r]/;
const escapeForExcel = (value) => {
    if (typeof value !== 'string') return value;
    return DANGEROUS_CELL_PREFIX.test(value) ? `'${value}` : value;
};
const sanitizeRowsForExcel = (rows) => rows.map(row => {
    const out = {};
    for (const [k, v] of Object.entries(row)) out[k] = escapeForExcel(v);
    return out;
});
// Allow-list of roles that may be assigned via the API. Any value not here is rejected.
const ASSIGNABLE_ROLES = [...OC_USER_ROLES, 'ADMIN'];
// Roles which require ADMIN-only assignment (cannot be granted by SAFETY_MANAGER / OC_HSE_MANAGER / HSE_CONTROLLER).
const ADMIN_ONLY_ROLES = new Set(['ADMIN']);
// Permission flags that, if granted, escalate the user toward admin-tier capabilities.
const ADMIN_ONLY_FLAGS = new Set(['canManageUsers']);

/**
 * Enforce role-assignment safety rules for createUser / updateUser.
 *   - Reject unknown roles (allow-list)
 *   - Forbid self-role-change
 *   - Forbid non-ADMIN from assigning or modifying ADMIN role
 *   - Forbid non-ADMIN from granting canManageUsers
 *
 * Returns { ok: true } on success, or { ok: false, status, message } on rejection.
 *
 * @param {object} actor - req.user (the caller)
 * @param {string|null} targetUserId - the user being modified (null for create)
 * @param {object} payload - { role, canManageUsers, ... }
 * @param {object|null} existingTarget - the current DB row of the target user (null for create)
 */
const enforceRoleAssignmentRules = (actor, targetUserId, payload, existingTarget) => {
    const { role, canManageUsers } = payload;

    // Rule 1: role must be in allow-list (if provided)
    if (role !== undefined && role !== null && !ASSIGNABLE_ROLES.includes(role)) {
        return { ok: false, status: 400, message: `Invalid role: ${role}` };
    }

    // Rule 2: a user cannot change their own role
    if (targetUserId && actor.id === targetUserId && role && existingTarget && role !== existingTarget.role) {
        return { ok: false, status: 403, message: 'You cannot change your own role' };
    }

    // Rule 3: only ADMIN can assign ADMIN role
    if (role && ADMIN_ONLY_ROLES.has(role) && actor.role !== 'ADMIN') {
        return { ok: false, status: 403, message: 'Only ADMIN can assign the ADMIN role' };
    }

    // Rule 4: only ADMIN can modify a user who is currently ADMIN
    if (existingTarget && ADMIN_ONLY_ROLES.has(existingTarget.role) && actor.role !== 'ADMIN') {
        return { ok: false, status: 403, message: 'Only ADMIN can modify an ADMIN user' };
    }

    // Rule 5: only ADMIN can grant admin-tier permission flags
    if (canManageUsers === true && actor.role !== 'ADMIN') {
        return { ok: false, status: 403, message: 'Only ADMIN can grant user-management permission' };
    }
    // (Defensive: catch any future admin-tier flag added to payload)
    for (const flag of ADMIN_ONLY_FLAGS) {
        if (payload[flag] === true && actor.role !== 'ADMIN') {
            return { ok: false, status: 403, message: `Only ADMIN can grant the "${flag}" permission` };
        }
    }

    return { ok: true };
};

const getUsers = async (req, res) => {
    try {
        if (!ADMIN_ROLES.includes(req.user.role)) return res.status(403).json({ message: 'Not authorized' });
        const users = await prisma.user.findMany({
            where: { role: { in: [...OC_USER_ROLES, 'ADMIN'] } },
            select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, mobile: true, canCloseTickets: true, canPerformRCA: true, canManageEvents: true, canManageServiceProviders: true, canViewAnalytics: true, isIntakeEnabled: true, canManageUsers: true, repDepartmentId: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(users);
    } catch (error) { res.status(500).json({ message: 'Error fetching users' }); }
};

const createUser = async (req, res) => {
    try {
        if (!ADMIN_ROLES.includes(req.user.role)) return res.status(403).json({ message: 'Not authorized' });
        const { name, email, role, mobile, canCloseTickets, canPerformRCA,
                canManageEvents, canManageServiceProviders, canManageUsers,
                canViewAnalytics, isIntakeEnabled, repDepartmentId } = req.body;
        if (!name || !email) return res.status(400).json({ message: 'Name and email required' });

        // Enforce role-assignment safety rules (C3)
        const ruleCheck = enforceRoleAssignmentRules(req.user, null, req.body, null);
        if (!ruleCheck.ok) return res.status(ruleCheck.status).json({ message: ruleCheck.message });

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(400).json({ message: 'Email exists' });
        const parts = name.trim().split(/\s+/);
        const firstName = parts[0] || '';
        const lastName = parts.length > 1 ? parts.slice(-1)[0] : '';
        const fatherName = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';

        // Point 9: auto-link DEP_REP/DEP_MANAGER to department
        const effectiveRepDeptId = ['DEP_REP', 'DEP_MANAGER'].includes(role) ? (repDepartmentId || null) : null;

        const user = await prisma.user.create({
            data: {
                name, firstName, fatherName, lastName, email, password: '',
                role: role || 'OC_REPORTER', userGroup: 'OFF_CIRCUIT',
                mobile: mobile || null, status: 'ACTIVE',
                canCloseTickets: !!canCloseTickets,
                canPerformRCA: !!canPerformRCA,
                canManageEvents: !!canManageEvents,
                canManageServiceProviders: !!canManageServiceProviders,
                canManageUsers: !!canManageUsers,  // gated by rule check above; only ADMIN can set true
                canViewAnalytics: !!canViewAnalytics,
                isIntakeEnabled: !!isIntakeEnabled,
                repDepartmentId: effectiveRepDeptId,
            }
        });
        res.status(201).json({ message: 'User created', user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        logger.error({ err: error }, 'createUser failed');
        res.status(500).json({ message: 'Error creating user' });
    }
};

const updateUser = async (req, res) => {
    try {
        if (!ADMIN_ROLES.includes(req.user.role)) return res.status(403).json({ message: 'Not authorized' });
        const { name, email, role, mobile, canCloseTickets, canPerformRCA,
                canManageEvents, canManageServiceProviders, canManageUsers,
                canViewAnalytics, isIntakeEnabled, repDepartmentId } = req.body;

        // Load existing target to enforce admin-only modification rules
        const existingTarget = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: { id: true, role: true, repDepartmentId: true }
        });
        if (!existingTarget) return res.status(404).json({ message: 'User not found' });

        // Enforce role-assignment safety rules (C3)
        const ruleCheck = enforceRoleAssignmentRules(req.user, req.params.id, req.body, existingTarget);
        if (!ruleCheck.ok) return res.status(ruleCheck.status).json({ message: ruleCheck.message });

        const data = {};
        if (name) {
            data.name = name;
            const parts = name.trim().split(/\s+/);
            data.firstName = parts[0] || '';
            data.lastName = parts.length > 1 ? parts.slice(-1)[0] : '';
            data.fatherName = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';
        }
        if (email) data.email = email;
        if (role) data.role = role;
        if (mobile !== undefined) data.mobile = mobile;
        if (typeof canCloseTickets === 'boolean') data.canCloseTickets = canCloseTickets;
        if (typeof canPerformRCA === 'boolean') data.canPerformRCA = canPerformRCA;
        if (typeof canManageEvents === 'boolean') data.canManageEvents = canManageEvents;
        if (typeof canManageServiceProviders === 'boolean') data.canManageServiceProviders = canManageServiceProviders;
        if (typeof canManageUsers === 'boolean') data.canManageUsers = canManageUsers;  // gated by rule check
        if (typeof canViewAnalytics === 'boolean') data.canViewAnalytics = canViewAnalytics;
        if (typeof isIntakeEnabled === 'boolean') data.isIntakeEnabled = isIntakeEnabled;
        data.userGroup = 'OFF_CIRCUIT';

        // Point 9: handle repDepartmentId for DEP_REP/DEP_MANAGER
        const effectiveRole = role || existingTarget.role;
        if (['DEP_REP', 'DEP_MANAGER'].includes(effectiveRole)) {
            // If repDepartmentId was provided, use it; otherwise keep existing
            if (repDepartmentId !== undefined) {
                data.repDepartmentId = repDepartmentId || null;
            }
        } else {
            // Role is not DEP_REP/DEP_MANAGER → unlink from department
            if (existingTarget.repDepartmentId) {
                data.repDepartmentId = null;
            }
        }

        const user = await prisma.user.update({ where: { id: req.params.id }, data });
        res.json({ message: 'Updated', user: { id: user.id, name: user.name, role: user.role } });
    } catch (error) {
        logger.error({ err: error }, 'updateUser failed');
        res.status(500).json({ message: 'Error updating user' });
    }
};

const suspendUser = async (req, res) => {
    try {
        if (!ADMIN_ROLES.includes(req.user.role)) return res.status(403).json({ message: 'Not authorized' });
        const openTickets = await prisma.ticket.count({ where: { OR: [{ createdById: req.params.id, status: { not: 'CLOSED' } }, { assignedToId: req.params.id, status: { not: 'CLOSED' } }] } });
        if (openTickets > 0) return res.status(400).json({ message: `Cannot suspend: ${openTickets} open ticket(s)` });
        await prisma.user.update({ where: { id: req.params.id }, data: { status: 'SUSPENDED' } });
        res.json({ message: 'User deactivated' });
    } catch (error) { res.status(500).json({ message: 'Error' }); }
};

const toggleUserStatus = async (req, res) => {
    try {
        if (!ADMIN_ROLES.includes(req.user.role)) return res.status(403).json({ message: 'Not authorized' });

        const VALID_STATUSES = ['ACTIVE', 'PENDING', 'SUSPENDED', 'BANNED'];
        const { status } = req.body;
        if (!status || !VALID_STATUSES.includes(status)) {
            return res.status(400).json({ message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
        }

        await prisma.user.update({ where: { id: req.params.id }, data: { status } });
        res.json({ message: `Status updated to ${status}` });
    } catch (error) { res.status(500).json({ message: 'Error updating status' }); }
};

// ════════════════════════════════════════════════════════════════════════════
// HSE ANALYTICS — Best-practice manager dashboard
// Saudi industrial pyramid ratio: 1 LTI : 10 Medical : 30 Near-Miss : 100 Observation
// LTI definition: type === LOST_TIME_INJURY OR severityLevel ∈ {MAJOR, SEVERE, CRITICAL, SERIOUS}
// ════════════════════════════════════════════════════════════════════════════
const HIGH_SEVERITY = new Set(['MAJOR', 'SEVERE', 'CRITICAL', 'SERIOUS']);
// PYRAMID_RATIO: Saudi industrial benchmark — 10 Medical : 30 Near-Miss : 100 Observation per 1 LTI.
// Note: the lti ratio key (= 1) is omitted here because it is the base unit used implicitly;
// only the multiples for medical, nearMiss, and observation are needed in the deviation calculation.
const PYRAMID_RATIO = { medical: 10, nearMiss: 30, observation: 100 }; // Saudi industrial

// Classify a ticket into the pyramid level for HSE reporting.
// Active TicketType values: OBSERVATION, SECURITY, ACCIDENT.
// Active severityLevel values: MINOR, SIGNIFICANT, MAJOR, SEVERE.
const classifyPyramid = (t) => {
    const type = t.type || '';
    const sev  = t.severityLevel || '';

    if (type === 'SECURITY') return 'other';

    // Injuries / Actual Incidents
    if (t.hasInjury || type === 'ACCIDENT' || type === 'INJURY') {
        if (HIGH_SEVERITY.has(sev)) return 'lti';
        return 'medical';
    }

    // High-severity observation without injury → Near-Miss
    if (HIGH_SEVERITY.has(sev) || type === 'NEAR_MISS') return 'nearMiss';

    return 'observation';
};

const getAnalytics = async (req, res) => {
    try {
        const { role, canViewAnalytics, repDepartmentId, department: userDept } = req.user;
        const hasAnalyticsPermission = !!canViewAnalytics || role === 'ADMIN' || ['HSE_CONTROLLER', 'SAFETY_MANAGER'].includes(role);
        if (!hasAnalyticsPermission) {
            return res.status(403).json({ message: 'غير مصرح لك بالاطلاع على صفحة الإحصائيات. يجب منحك التصريح من إدارة النظام.' });
        }

        const { from, to, year, quarter, month, departmentId: requestedDeptId, status: requestedStatus, severity: requestedSeverity } = req.query;

        // Department role scoping: DEP_MANAGER and DEP_REP can ONLY see their department!
        const isDepRestricted = ['DEP_MANAGER', 'DEP_REP'].includes(role);
        let userDeptRecord = null;
        if (repDepartmentId) {
            userDeptRecord = await prisma.department.findUnique({ where: { id: repDepartmentId } });
        } else if (userDept) {
            userDeptRecord = await prisma.department.findFirst({
                where: { OR: [{ id: userDept }, { name: userDept }, { nameAr: userDept }] }
            });
        }

        let effectiveDeptId = null;
        if (isDepRestricted) {
            effectiveDeptId = userDeptRecord?.id || repDepartmentId || null;
        } else if (requestedDeptId && requestedDeptId !== 'ALL') {
            effectiveDeptId = requestedDeptId;
        }

        const where = { userGroup: 'OFF_CIRCUIT' };

        if (effectiveDeptId) {
            where.departmentId = effectiveDeptId;
        }

        // Handle Quarter / Month / Date Range filtering
        if (quarter && year) {
            const q = parseInt(quarter, 10);
            const y = parseInt(year, 10);
            const startMonth = (q - 1) * 3; // 0, 3, 6, 9
            const qStart = new Date(Date.UTC(y, startMonth, 1));
            const qEnd = new Date(Date.UTC(y, startMonth + 3, 0, 23, 59, 59, 999));
            where.createdAt = { gte: qStart, lte: qEnd };
        } else if (month && year) {
            const m = parseInt(month, 10) - 1;
            const y = parseInt(year, 10);
            const mStart = new Date(Date.UTC(y, m, 1));
            const mEnd = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
            where.createdAt = { gte: mStart, lte: mEnd };
        } else if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from);
            if (to) {
                const endDate = new Date(to);
                endDate.setHours(23, 59, 59, 999);
                where.createdAt.lte = endDate;
            }
        }

        // Status filter
        if (requestedStatus && requestedStatus !== 'ALL') {
            if (requestedStatus === 'OPEN') {
                where.status = { in: ['SUBMITTED', 'RETURNED_TO_REPORTER'] };
            } else if (requestedStatus === 'IN_PROGRESS') {
                where.status = { in: ['ASSIGNED', 'UNDER_REVIEW', 'RETURNED_TO_DEPARTMENT', 'PENDING_REMINDER', 'ESCALATED'] };
            } else if (requestedStatus === 'CLOSED') {
                where.status = 'CLOSED';
            } else {
                where.status = requestedStatus;
            }
        }

        // Severity filter
        if (requestedSeverity && requestedSeverity !== 'ALL') {
            where.severityLevel = requestedSeverity;
        }

        // Fetch everything in parallel ────────────────────────────────────────
        const [tickets, actionPlans, departments, serviceProviders] = await Promise.all([
            prisma.ticket.findMany({
                where,
                select: {
                    id: true, type: true, status: true, priority: true, hasInjury: true,
                    severityLevel: true, createdAt: true, closedAt: true, createdById: true,
                    description: true,
                    departmentId: true, zoneId: true, eventId: true, serviceProviderId: true, location: true, ticketNo: true,
                    department: { select: { id: true, name: true, nameAr: true } },
                    zone: { select: { id: true, name: true } },
                    event: { select: { id: true, nameEn: true, nameAr: true } },
                    serviceProvider: { select: { id: true, name: true, commercialRegistrationNumber: true, status: true, department: { select: { name: true, nameAr: true } } } },
                    offCircuitReport: { select: { whatHappened: true, incidentDate: true, incidentTime: true, locationAddress: true, locationDescription: true, isLateReport: true, rcaRequired: true, rcaCompleted: true, gosiSubmitted: true, contractorNotified: true, locationLat: true, locationLng: true, detectionSource: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.actionPlan.findMany({
                select: { id: true, ticketId: true, type: true, status: true, targetDate: true, departmentId: true, submittedAt: true, department: { select: { name: true, nameAr: true } } },
            }),
            prisma.department.findMany({ select: { id: true, name: true, nameAr: true } }),
            prisma.serviceProvider.findMany({ select: { id: true, name: true, commercialRegistrationNumber: true, status: true, department: { select: { name: true, nameAr: true } } } }),
        ]);

        const totalTickets = tickets.length;
        const now = new Date();

        // ── 1. KPI HERO ────────────────────────────────────────────────────────
        // Days since last LTI
        const ltiTickets = tickets.filter(t => classifyPyramid(t) === 'lti').sort((a, b) => b.createdAt - a.createdAt);
        const lastLTI = ltiTickets[0];
        const daysSinceLastLTI = lastLTI
            ? Math.floor((now - lastLTI.createdAt) / 86400000)
            : null; // null = no LTI ever recorded

        const openTickets = tickets.filter(t => t.status !== 'CLOSED');
        const overdueActionPlans = actionPlans.filter(p =>
            p.targetDate && new Date(p.targetDate) < now && p.status !== 'APPROVED' && p.status !== 'REJECTED'
        );

        // ── 2. PYRAMID (Heinrich-style, Saudi industrial baseline) ─────────────
        const pyramid = { fatality: 0, lti: 0, medical: 0, nearMiss: 0, observation: 0, other: 0 };
        tickets.forEach(t => { pyramid[classifyPyramid(t)]++; });

        // Compare to ideal (using the largest level as anchor)
        const ltiCount = pyramid.lti + pyramid.fatality;
        const expectedMedical     = ltiCount * PYRAMID_RATIO.medical;
        const expectedNearMiss    = ltiCount * PYRAMID_RATIO.nearMiss;
        const expectedObservation = ltiCount * PYRAMID_RATIO.observation;
        const pyramidGap = {
            medical:     ltiCount > 0 ? Math.max(0, expectedMedical     - pyramid.medical)     : 0,
            nearMiss:    ltiCount > 0 ? Math.max(0, expectedNearMiss    - pyramid.nearMiss)    : 0,
            observation: ltiCount > 0 ? Math.max(0, expectedObservation - pyramid.observation) : 0,
        };

        // ── 3. LEADING vs LAGGING INDICATORS ───────────────────────────────────
        const leading = {
            nearMiss:     pyramid.nearMiss,
            observation:  pyramid.observation,
            actionPlansApproved: actionPlans.filter(p => p.status === 'APPROVED').length,
            actionPlansOnTime:   actionPlans.filter(p => p.status === 'APPROVED' && p.targetDate && p.submittedAt && new Date(p.submittedAt) <= new Date(p.targetDate)).length,
        };
        const lagging = {
            fatality:    pyramid.fatality,
            lti:         pyramid.lti,
            medical:     pyramid.medical,
            totalInjuries: tickets.filter(t => t.hasInjury).length,
        };

        // ── 4. REPORTING CULTURE INDEX (RCI) ───────────────────────────────────
        // Component A: Near-Miss Ratio (40%)
        const accidents      = pyramid.lti + pyramid.medical + pyramid.fatality;
        const proactiveCount = pyramid.nearMiss + pyramid.observation;
        const idealRatio     = PYRAMID_RATIO.nearMiss + PYRAMID_RATIO.observation; // 130
        const actualRatio    = accidents > 0 ? proactiveCount / accidents : (proactiveCount > 0 ? idealRatio : 0);
        const nearMissScore  = Math.min(100, Math.round((actualRatio / idealRatio) * 100));

        // Component B: Reporter Diversity (25%)
        const reporters       = tickets.map(t => t.createdById).filter(Boolean);
        const uniqueReporters = new Set(reporters).size;
        const diversityRaw    = totalTickets > 0 ? (uniqueReporters / totalTickets) * 100 : 0;
        // Cap: 40%+ unique = excellent (a single reporter can't be 100% of reports)
        const diversityScore  = Math.min(100, Math.round(diversityRaw * 2.5));

        // Component C: Proactive Rate (20%)
        const proactiveRate  = totalTickets > 0 ? (proactiveCount / totalTickets) * 100 : 0;
        const proactiveScore = Math.min(100, Math.round(proactiveRate * 1.4)); // 70%+ → 100

        // Component D: Timeliness (15%)
        const timely    = tickets.filter(t => !t.offCircuitReport?.isLateReport).length;
        const timelyPct = totalTickets > 0 ? Math.round((timely / totalTickets) * 100) : 100;

        const rci = Math.round(nearMissScore * 0.4 + diversityScore * 0.25 + proactiveScore * 0.20 + timelyPct * 0.15);
        const rciLevel = rci >= 80 ? 'EXCELLENT' : rci >= 60 ? 'GOOD' : rci >= 40 ? 'CONCERNING' : 'POOR';

        // RCI trend: compare with 30-60 days ago
        const sixtyDaysAgo  = new Date(now); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const prevPeriod = tickets.filter(t => t.createdAt >= sixtyDaysAgo && t.createdAt < thirtyDaysAgo);
        let prevRci = null;
        if (prevPeriod.length > 0) {
            const prevP = { lti: 0, medical: 0, nearMiss: 0, observation: 0, fatality: 0, other: 0 };
            prevPeriod.forEach(t => prevP[classifyPyramid(t)]++);
            const prevAcc  = prevP.lti + prevP.medical + prevP.fatality;
            const prevPro  = prevP.nearMiss + prevP.observation;
            const prevRatio = prevAcc > 0 ? prevPro / prevAcc : (prevPro > 0 ? idealRatio : 0);
            prevRci = Math.round(Math.min(100, (prevRatio / idealRatio) * 100) * 0.4 + 50 * 0.6);
        }

        // ── 5. PER-DEPARTMENT REPORTING CULTURE SCORECARD ──────────────────────
        const deptMap = {};
        departments.forEach(d => {
            deptMap[d.id] = { id: d.id, nameAr: d.nameAr || d.name, nameEn: d.name || d.nameAr, total: 0, lti: 0, medical: 0, nearMiss: 0, observation: 0, reporters: new Set() };
        });
        tickets.forEach(t => {
            if (!t.departmentId || !deptMap[t.departmentId]) return;
            const d = deptMap[t.departmentId];
            d.total++;
            const cls = classifyPyramid(t);
            if (cls in d) d[cls]++;
            if (t.createdById) d.reporters.add(t.createdById);
        });
        const departmentCulture = Object.values(deptMap)
            .filter(d => d.total > 0)
            .map(d => {
                const acc = d.lti + d.medical;
                const pro = d.nearMiss + d.observation;
                const ratio = acc > 0 ? pro / acc : (pro > 0 ? 999 : 0);
                const deptRci = Math.round(Math.min(100, (ratio / idealRatio) * 100) * 0.6 + (Math.min(100, (d.reporters.size / d.total) * 250)) * 0.4);
                let alert = null;
                if (acc >= 2 && pro === 0) alert = 'SUSPECTED_UNDER_REPORTING';
                else if (d.reporters.size === 1 && d.total >= 3) alert = 'SINGLE_REPORTER';
                return {
                    id: d.id, nameAr: d.nameAr, nameEn: d.nameEn, total: d.total,
                    accidents: acc, proactive: pro, ratio: ratio === 999 ? null : Math.round(ratio * 10) / 10,
                    uniqueReporters: d.reporters.size, rci: deptRci, alert,
                };
            })
            .sort((a, b) => b.total - a.total);

        // ── 6. INSIGHTS (auto-generated) ───────────────────────────────────────
        const insights = [];
        if (rci < 40) insights.push({ level: 'CRITICAL', textAr: `مؤشر ثقافة التبليغ منخفض (${rci}/100) — يُحتمل وجود مخاطر مخفية بسبب ضعف ثقافة التبليغ`, textEn: `Low Reporting Culture Index (${rci}/100) — Hidden risks likely due to poor reporting` });
        else if (rci >= 80) insights.push({ level: 'POSITIVE', textAr: `ثقافة تبليغ ممتازة (${rci}/100) — حافظ على هذا المستوى`, textEn: `Excellent Reporting Culture (${rci}/100) — Maintain this level` });

        if (overdueActionPlans.length > 0) insights.push({ level: 'WARNING', textAr: `يوجد ${overdueActionPlans.length} خطة عمل متأخرة عن موعدها — تحتاج متابعة فورية`, textEn: `There are ${overdueActionPlans.length} overdue action plans — Immediate follow-up required` });

        const suspectedDepts = departmentCulture.filter(d => d.alert === 'SUSPECTED_UNDER_REPORTING');
        if (suspectedDepts.length > 0) insights.push({ level: 'WARNING', textAr: `${suspectedDepts.map(d => d.nameAr).join('، ')}: حوادث مسجلة دون أي Near-Miss — يُحتمل تبليغ ناقص`, textEn: `${suspectedDepts.map(d => d.nameEn).join(', ')}: Incidents recorded without any Near-Misses — Possible under-reporting` });

        const singleReporterDepts = departmentCulture.filter(d => d.alert === 'SINGLE_REPORTER');
        if (singleReporterDepts.length > 0) insights.push({ level: 'INFO', textAr: `${singleReporterDepts.map(d => d.nameAr).join('، ')}: شخص واحد فقط يبلّغ — يحتاج توعية بقية الفريق`, textEn: `${singleReporterDepts.map(d => d.nameEn).join(', ')}: Only one person is reporting — Team awareness needed` });

        if (pyramidGap.nearMiss > 0) insights.push({ level: 'WARNING', textAr: `النموذج المثالي يتوقع ${expectedNearMiss} Near-Miss مقابل عدد LTI الحالي، الفعلي ${pyramid.nearMiss} فقط — فجوة ${pyramidGap.nearMiss}`, textEn: `Ideal model expects ${expectedNearMiss} Near-Misses against current LTI, actual is only ${pyramid.nearMiss} — Gap of ${pyramidGap.nearMiss}` });

        if (proactiveRate < 30 && totalTickets >= 10) insights.push({ level: 'WARNING', textAr: `معدل التبليغ الاستباقي منخفض (${Math.round(proactiveRate)}%) — يُفضّل تشجيع تبليغ Near-Miss والمشاهدات`, textEn: `Low proactive reporting rate (${Math.round(proactiveRate)}%) — Encourage Near-Miss and Observation reporting` });

        if (timelyPct < 70 && totalTickets >= 5) insights.push({ level: 'WARNING', textAr: `${100 - timelyPct}% من البلاغات تأخرت أكثر من 24 ساعة — قد يدل على تردد في التبليغ`, textEn: `${100 - timelyPct}% of reports were delayed over 24 hours — May indicate reporting hesitation` });

        // ── 7. RISK HEATMAPS ───────────────────────────────────────────────────
        // By zone (existing format)
        const zoneMap = {};
        tickets.filter(t => t.zoneId).forEach(t => {
            const zoneName = t.zone?.name || t.zoneId;
            if (!zoneMap[t.zoneId]) zoneMap[t.zoneId] = { name: zoneName, count: 0, injuries: 0, severities: {} };
            zoneMap[t.zoneId].count++;
            if (t.hasInjury) zoneMap[t.zoneId].injuries++;
            if (t.severityLevel) zoneMap[t.zoneId].severities[t.severityLevel] = (zoneMap[t.zoneId].severities[t.severityLevel] || 0) + 1;
        });
        const zoneDistribution = Object.values(zoneMap).sort((a, b) => b.count - a.count);

        // By event (incidents per event/championship)
        const eventMap = {};
        tickets.filter(t => t.eventId).forEach(t => {
            const ev = t.event;
            if (!eventMap[t.eventId]) eventMap[t.eventId] = {
                id: t.eventId,
                nameEn: ev?.nameEn || t.eventId,
                nameAr: ev?.nameAr || '',
                count: 0, injuries: 0, severities: {}
            };
            eventMap[t.eventId].count++;
            if (t.hasInjury) eventMap[t.eventId].injuries++;
            if (t.severityLevel) eventMap[t.eventId].severities[t.severityLevel] = (eventMap[t.eventId].severities[t.severityLevel] || 0) + 1;
        });
        const eventDistribution = Object.values(eventMap).sort((a, b) => b.count - a.count);

        // By department (count + injuries + avg response)
        const deptHeatRaw = {};
        tickets.filter(t => t.departmentId).forEach(t => {
            const d = t.department;
            const nameAr = d?.nameAr || d?.name || '—';
            const nameEn = d?.name || d?.nameAr || '—';
            if (!deptHeatRaw[t.departmentId]) deptHeatRaw[t.departmentId] = { id: t.departmentId, nameAr, nameEn, count: 0, injuries: 0, closedDurations: [] };
            deptHeatRaw[t.departmentId].count++;
            if (t.hasInjury) deptHeatRaw[t.departmentId].injuries++;
            if (t.status === 'CLOSED' && t.closedAt) deptHeatRaw[t.departmentId].closedDurations.push(t.closedAt - t.createdAt);
        });
        const departmentHeatmap = Object.values(deptHeatRaw)
            .map(d => ({
                id: d.id, nameAr: d.nameAr, nameEn: d.nameEn, count: d.count, injuries: d.injuries,
                avgClosureHours: d.closedDurations.length > 0 ? Math.round(d.closedDurations.reduce((a, b) => a + b, 0) / d.closedDurations.length / 3600000) : null,
            }))
            .sort((a, b) => b.count - a.count);

        // By hour of day (24 buckets)
        const byHourOfDay = Array(24).fill(0).map((_, h) => ({ hour: h, count: 0 }));
        tickets.forEach(t => { byHourOfDay[t.createdAt.getHours()].count++; });

        // By day of week (0=Sun, 6=Sat — Saudi week order: Sun-Sat)
        const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const byDayOfWeek = dayLabels.map((name, i) => ({ day: i, name, count: 0 }));
        tickets.forEach(t => { byDayOfWeek[t.createdAt.getDay()].count++; });

        // Pareto: types sorted desc by count
        const typeCounts = {};
        tickets.forEach(t => { typeCounts[t.type] = (typeCounts[t.type] || 0) + 1; });
        const paretoTypes = Object.entries(typeCounts)
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        // ── 8. RESPONSE TIMES ──────────────────────────────────────────────────
        const closedAll = tickets.filter(t => t.status === 'CLOSED' && t.closedAt);
        const totalMs   = closedAll.reduce((s, t) => s + (t.closedAt - t.createdAt), 0);
        const avgClosureHours = closedAll.length > 0 ? Math.round(totalMs / closedAll.length / 3600000) : 0;
        const avgClosureText  = avgClosureHours < 24
            ? `${avgClosureHours}h`
            : `${Math.floor(avgClosureHours / 24)}d ${avgClosureHours % 24}h`;

        // Avg closure by type
        const closureByType = {};
        closedAll.forEach(t => {
            if (!closureByType[t.type]) closureByType[t.type] = [];
            closureByType[t.type].push((t.closedAt - t.createdAt) / 3600000);
        });
        const avgClosureByType = Object.entries(closureByType).map(([type, arr]) => ({
            type, count: arr.length,
            avgHours: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
        })).sort((a, b) => b.avgHours - a.avgHours);

        // Top overdue departments (action plans)
        const overdueByDept = {};
        overdueActionPlans.forEach(p => {
            const nameAr = p.department?.nameAr || p.department?.name || '—';
            const nameEn = p.department?.name || p.department?.nameAr || '—';
            const key  = p.departmentId || 'none';
            if (!overdueByDept[key]) overdueByDept[key] = { id: key, nameAr, nameEn, count: 0, oldestDays: 0 };
            overdueByDept[key].count++;
            const days = Math.floor((now - new Date(p.targetDate)) / 86400000);
            if (days > overdueByDept[key].oldestDays) overdueByDept[key].oldestDays = days;
        });
        const topOverdueDepartments = Object.values(overdueByDept).sort((a, b) => b.count - a.count).slice(0, 5);

        // ── 9. COMPLIANCE ──────────────────────────────────────────────────────
        const ticketsWithInjury = tickets.filter(t => t.hasInjury);
        const gosiNeeded   = ticketsWithInjury.length; // approximation: every injury should report to GOSI
        const gosiSubmitted = ticketsWithInjury.filter(t => t.offCircuitReport?.gosiSubmitted === true).length;
        const gosiRate = gosiNeeded > 0 ? Math.round((gosiSubmitted / gosiNeeded) * 100) : 100;

        const lateReports = tickets.filter(t => t.offCircuitReport?.isLateReport).length;
        const lateReportRate = totalTickets > 0 ? Math.round((lateReports / totalTickets) * 100) : 0;

        const rcaNeeded   = tickets.filter(t => t.offCircuitReport?.rcaRequired).length;
        const rcaCompleted = tickets.filter(t => t.offCircuitReport?.rcaRequired && t.offCircuitReport?.rcaCompleted).length;
        const rcaRate = rcaNeeded > 0 ? Math.round((rcaCompleted / rcaNeeded) * 100) : 100;

        // ── 10. MONTHLY TREND (6 months) ───────────────────────────────────────
        const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const monthlyTrend = {};
        tickets.filter(t => t.createdAt >= sixMonthsAgo).forEach(t => {
            const k = `${t.createdAt.getFullYear()}-${String(t.createdAt.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyTrend[k]) monthlyTrend[k] = { total: 0, injuries: 0, lti: 0 };
            monthlyTrend[k].total++;
            if (t.hasInjury) monthlyTrend[k].injuries++;
            if (classifyPyramid(t) === 'lti' || classifyPyramid(t) === 'fatality') monthlyTrend[k].lti++;
        });

        // ── 11. TOP REPORTERS (existing) ───────────────────────────────────────
        const reporterCounts = {};
        const reporterTypeCounts = {};
        tickets.forEach(t => {
            if (!t.createdById) return;
            reporterCounts[t.createdById] = (reporterCounts[t.createdById] || 0) + 1;
            if (!reporterTypeCounts[t.createdById]) reporterTypeCounts[t.createdById] = { proactive: 0, total: 0 };
            reporterTypeCounts[t.createdById].total++;
            const cls = classifyPyramid(t);
            if (cls === 'nearMiss' || cls === 'observation') reporterTypeCounts[t.createdById].proactive++;
        });
        const topReporterIds = Object.entries(reporterCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([id]) => id);
        const reporterUsers = await prisma.user.findMany({
            where: { id: { in: topReporterIds } }, select: { id: true, name: true, role: true },
        });
        const topReporters = topReporterIds.map(id => {
            const u = reporterUsers.find(u => u.id === id);
            const tc = reporterTypeCounts[id] || { proactive: 0, total: 0 };
            return {
                id, name: u?.name || 'Unknown', role: u?.role || '',
                count: reporterCounts[id],
                proactiveRate: tc.total > 0 ? Math.round((tc.proactive / tc.total) * 100) : 0,
                champion: tc.proactive >= 5 && tc.proactive / tc.total >= 0.5,
            };
        });

        // ── ASSEMBLE RESPONSE ──────────────────────────────────────────────────
        // Status / priority / type distributions (kept for backward shape if needed)
        const byStatus   = {}; tickets.forEach(t => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });
        const byPriority = {}; tickets.forEach(t => { byPriority[t.priority] = (byPriority[t.priority] || 0) + 1; });

        res.json({
            // Hero KPIs
            totalTickets,
            openCount: openTickets.length,
            closedCount: closedAll.length,
            daysSinceLastLTI,
            lastLTIDate: lastLTI?.createdAt || null,
            overdueActionPlansCount: overdueActionPlans.length,

            // Pyramid
            pyramid,
            pyramidExpected: { lti: ltiCount, medical: expectedMedical, nearMiss: expectedNearMiss, observation: expectedObservation },
            pyramidGap,

            // Leading vs Lagging
            leading,
            lagging,

            // Reporting Culture
            reportingCulture: {
                rci, level: rciLevel,
                components: { nearMissRatio: nearMissScore, reporterDiversity: diversityScore, proactiveRate: proactiveScore, timeliness: timelyPct },
                rawValues: {
                    actualNearMissRatio: Math.round(actualRatio * 10) / 10,
                    idealNearMissRatio: idealRatio,
                    uniqueReporters, totalReporters: reporters.length,
                    proactivePercent: Math.round(proactiveRate),
                    timelyPercent: timelyPct,
                },
                trend: { current: rci, previous: prevRci },
                byDepartment: departmentCulture,
                insights,
            },

            // Heatmaps
            zoneDistribution,
            eventDistribution,
            departmentHeatmap,
            byHourOfDay,
            byDayOfWeek,
            paretoTypes,

            // Performance
            avgClosureHours, avgClosureText,
            avgClosureByType,
            topOverdueDepartments,

            // Compliance
            compliance: {
                gosiRate, gosiSubmitted, gosiNeeded,
                lateReportRate, lateReports,
                rcaRate, rcaCompleted, rcaNeeded,
            },

            // Trends + People
            monthlyTrend,
            topReporters,

            // Executive Dashboard Metrics (Matching Royal Commission / Authority Layout)
            isDepRestricted,
            userDepartment: userDeptRecord ? { id: userDeptRecord.id, name: userDeptRecord.name, nameAr: userDeptRecord.nameAr || userDeptRecord.name } : null,
            selectedDepartmentId: effectiveDeptId || 'ALL',
            departmentsList: departments.map(d => ({ id: d.id, name: d.name, nameAr: d.nameAr || d.name })),

            executiveKpis: {
                total: totalTickets,
                resolved: tickets.filter(t => t.status === 'CLOSED').length,
                inProgress: tickets.filter(t => t.status !== 'CLOSED').length,
                onTrack: tickets.filter(t => t.status === 'CLOSED' || !t.offCircuitReport?.isLateReport).length,
                overdue: tickets.filter(t => (t.status !== 'CLOSED' && overdueActionPlans.some(p => p.ticketId === t.id)) || t.offCircuitReport?.isLateReport).length,
                critical: tickets.filter(t => t.severityLevel === 'MAJOR' || t.priority === 'CRITICAL' || t.hasInjury).length
            },

            unitsBreakdown: (() => {
                const safetyTypes = ['OBSERVATION', 'UNSAFE_CONDITION', 'UNSAFE_ACT', 'ACCIDENT', 'NEAR_MISS'];
                const securityTypes = ['SECURITY', 'SECURITY_BREACH', 'VIOLATION'];
                const healthTypes = ['HEALTH', 'INJURY', 'PROPERTY_DAMAGE', 'OTHER'];

                const getUnitStats = (types, labelAr, labelEn, icon, color) => {
                    const unitTickets = tickets.filter(t => types.includes(t.type));
                    const open = unitTickets.filter(t => ['SUBMITTED', 'RETURNED_TO_REPORTER'].includes(t.status)).length;
                    const inProgress = unitTickets.filter(t => ['ASSIGNED', 'UNDER_REVIEW', 'RETURNED_TO_DEPARTMENT', 'PENDING_REMINDER', 'ESCALATED'].includes(t.status)).length;
                    const closed = unitTickets.filter(t => t.status === 'CLOSED').length;
                    const major = unitTickets.filter(t => t.severityLevel === 'MAJOR').length;
                    return {
                        key: labelEn.toLowerCase(),
                        labelAr,
                        labelEn,
                        icon,
                        color,
                        total: unitTickets.length,
                        open,
                        inProgress,
                        closed,
                        major
                    };
                };

                return [
                    getUnitStats(safetyTypes, 'السلامة', 'Safety', '🦺', '#10b981'),
                    getUnitStats(securityTypes, 'الأمن', 'Security', '🛡️', '#3b82f6'),
                    getUnitStats(healthTypes, 'الصحة والبيئة', 'Health & Env', '🏥', '#f59e0b')
                ];
            })(),

            // trainingHours: returns incident count breakdowns per category.
            // NOTE: These are NOT computed from actual training records — a dedicated
            // training module does not exist yet. The counts reflect incident activity only
            // and should be treated as a proxy metric until real training data is available.
            trainingHours: (() => {
                const safetyCount   = tickets.filter(t => ['OBSERVATION', 'UNSAFE_CONDITION', 'UNSAFE_ACT', 'ACCIDENT', 'NEAR_MISS'].includes(t.type)).length;
                const securityCount = tickets.filter(t => ['SECURITY', 'SECURITY_BREACH', 'VIOLATION'].includes(t.type)).length;
                const uniqueReporters = new Set(tickets.map(t => t.createdById).filter(Boolean)).size;
                return {
                    // Raw counts — no synthetic hour multiplication to avoid misleading metrics
                    safetyIncidents:   safetyCount,
                    securityIncidents: securityCount,
                    totalIncidents:    safetyCount + securityCount,
                    uniqueReporters,
                    // Legacy-compatible aliases (retained so existing frontend charts don't break)
                    safetyHours:   safetyCount,
                    securityHours: securityCount,
                    totalHours:    safetyCount + securityCount,
                    traineesCount: uniqueReporters,
                    isEstimated: true // flag so UI can show a disclaimer
                };
            })(),

            detailsList: tickets.slice(0, 50).map(t => {
                const isSec = ['SECURITY', 'SECURITY_BREACH', 'VIOLATION'].includes(t.type);
                const isHealth = ['HEALTH', 'INJURY', 'PROPERTY_DAMAGE'].includes(t.type);
                const unitNameAr = isSec ? 'الأمن' : isHealth ? 'الصحة والبيئة' : 'السلامة';
                const unitNameEn = isSec ? 'Security' : isHealth ? 'Health & Env' : 'Safety';
                return {
                    id: t.id,
                    ticketNo: t.ticketNo,
                    title: t.offCircuitReport?.whatHappened || t.description || 'ملاحظة أمن وسلامة',
                    unitAr: unitNameAr,
                    unitEn: unitNameEn,
                    status: t.status,
                    severityLevel: t.severityLevel || 'MINOR',
                    createdAt: t.createdAt,
                    incidentDate: t.offCircuitReport?.incidentDate || t.createdAt,
                    location: t.location || t.offCircuitReport?.locationAddress || '-',
                    departmentName: t.department?.name || 'N/A',
                    departmentNameAr: t.department?.nameAr || t.department?.name || 'N/A',
                    detectionSource: t.offCircuitReport?.detectionSource || 'INTERNAL_OBSERVATION'
                };
            }),

            severityDistribution: [
                { key: 'MAJOR', labelAr: 'عالية (Major)', labelEn: 'Major (High)', count: tickets.filter(t => t.severityLevel === 'MAJOR').length, color: '#ef4444' },
                { key: 'SIGNIFICANT', labelAr: 'متوسطة (Significant)', labelEn: 'Significant (Medium)', count: tickets.filter(t => t.severityLevel === 'SIGNIFICANT').length, color: '#f59e0b' },
                { key: 'MINOR', labelAr: 'منخفضة (Minor)', labelEn: 'Minor (Low)', count: tickets.filter(t => !t.severityLevel || t.severityLevel === 'MINOR').length, color: '#10b981' }
            ],

            deptStatusBreakdown: departments.map(d => {
                const deptTickets = tickets.filter(t => t.departmentId === d.id);
                const open = deptTickets.filter(t => t.status !== 'CLOSED').length;
                const closed = deptTickets.filter(t => t.status === 'CLOSED').length;
                return {
                    id: d.id,
                    name: d.name,
                    nameAr: d.nameAr || d.name,
                    total: deptTickets.length,
                    open,
                    closed
                };
            }).sort((a, b) => b.total - a.total).slice(0, 10),

            locationDistribution: (() => {
                const locMap = {};
                tickets.forEach(t => {
                    const loc = t.zone?.name || t.location || 'حلبة كورنيش جدة';
                    locMap[loc] = (locMap[loc] || 0) + 1;
                });
                return Object.entries(locMap)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 6);
            })(),

            // Map Cases with real coordinates and ticket details
            mapCases: tickets.map(t => ({
                id: t.id,
                ticketNo: t.ticketNo,
                status: t.status,
                severityLevel: t.severityLevel || t.offCircuitReport?.severity || 'MINOR',
                locationLat: t.offCircuitReport?.locationLat || 21.5433,
                locationLng: t.offCircuitReport?.locationLng || 39.1728,
                location: t.location || t.offCircuitReport?.locationAddress || 'حلبة كورنيش جدة',
                departmentName: t.department?.nameAr || t.department?.name || 'N/A'
            })),

            // Detection Sources Breakdown
            // Compute srcMap once — used by both detectionSources and detectionSourceStats
            // to avoid iterating tickets twice for the same data.
            ...(() => {
                const srcMap = {
                    INSPECTION: 0,
                    AUDIT: 0,
                    INTERNAL_OBSERVATION: 0,
                    EXTERNAL_SOURCE: 0
                };
                tickets.forEach(t => {
                    const src = t.offCircuitReport?.detectionSource || 'INTERNAL_OBSERVATION';
                    if (srcMap[src] !== undefined) {
                        srcMap[src]++;
                    } else {
                        srcMap.INTERNAL_OBSERVATION++;
                    }
                });
                return {
                    detectionSources: { ...srcMap },
                    detectionSourceStats: [
                        { key: 'INSPECTION',          labelEn: 'Inspection',            labelAr: 'تفتيش ميداني',   icon: '🔍', count: srcMap.INSPECTION,          percentage: totalTickets > 0 ? Math.round((srcMap.INSPECTION          / totalTickets) * 100) : 0, color: '#3b82f6' },
                        { key: 'AUDIT',               labelEn: 'Audit',                 labelAr: 'تدقيق',          icon: '📋', count: srcMap.AUDIT,               percentage: totalTickets > 0 ? Math.round((srcMap.AUDIT               / totalTickets) * 100) : 0, color: '#8b5cf6' },
                        { key: 'INTERNAL_OBSERVATION',labelEn: 'Internal Observation',  labelAr: 'ملاحظة داخلية', icon: '👁️', count: srcMap.INTERNAL_OBSERVATION, percentage: totalTickets > 0 ? Math.round((srcMap.INTERNAL_OBSERVATION / totalTickets) * 100) : 0, color: '#10b981' },
                        { key: 'EXTERNAL_SOURCE',     labelEn: 'External Observation',  labelAr: 'ملاحظة خارجية', icon: '🌐', count: srcMap.EXTERNAL_SOURCE,     percentage: totalTickets > 0 ? Math.round((srcMap.EXTERNAL_SOURCE     / totalTickets) * 100) : 0, color: '#f59e0b' },
                    ],
                };
            })(),

            // Available calendar years — derived from already-loaded tickets array,
            // no extra DB round-trip needed.
            availableYears: (() => {
                const ySet = new Set(tickets.map(t => new Date(t.createdAt).getFullYear()));
                const arr = Array.from(ySet).sort((a, b) => b - a);
                return arr.length > 0 ? arr : [new Date().getFullYear()];
            })(),

            // Backward-compatible (if any caller still reads these)
            statusDistribution: byStatus,
            priorityDistribution: byPriority,
            typeDistribution: typeCounts,
            totalInjuries: lagging.totalInjuries,

            // Service Provider Violations
            serviceProviderViolations: (() => {
                const spMap = {};
                tickets.forEach(t => {
                    if (!t.serviceProviderId || !t.serviceProvider) return;
                    const spId = t.serviceProviderId;
                    if (!spMap[spId]) {
                        spMap[spId] = {
                            id: spId,
                            name: t.serviceProvider.name,
                            crNumber: t.serviceProvider.commercialRegistrationNumber,
                            status: t.serviceProvider.status,
                            department: t.serviceProvider.department?.name || 'N/A',
                            departmentAr: t.serviceProvider.department?.nameAr || '',
                            totalViolations: 0,
                            hasInjury: 0,
                            byType: {},
                        };
                    }
                    spMap[spId].totalViolations++;
                    if (t.hasInjury) spMap[spId].hasInjury++;
                    const tType = t.type || 'OTHER';
                    spMap[spId].byType[tType] = (spMap[spId].byType[tType] || 0) + 1;
                });
                return Object.values(spMap)
                    .sort((a, b) => b.totalViolations - a.totalViolations)
                    .slice(0, 10);
            })(),
        });
    } catch (error) {
        logger.error({ err: error }, 'Analytics Error:');
        res.status(500).json({ message: 'Failed' });
    }
};

const downloadUserTemplate = async (req, res) => {
    try {
        const ws = xlsx.utils.json_to_sheet([
            { 'First Name': 'Ahmed', 'Father Name': 'Ali', 'Last Name': 'Alsaeed', 'Email': 'ahmed@co.com', 'Mobile Number': '+966500000000', 'Department': 'HSE', 'Role': 'REPORTER' },
        ]);
        const wb = xlsx.utils.book_new(); xlsx.utils.book_append_sheet(wb, ws, 'Users');
        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename="template.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (error) { res.status(500).json({ message: 'Failed' }); }
};

const ROLE_MAP = { 
    'REPORTER': 'OC_REPORTER', 
    'OC_REPORTER': 'OC_REPORTER', 
    'CONTROLLER': 'HSE_CONTROLLER', 
    'HSE_CONTROLLER': 'HSE_CONTROLLER', 
    'HSE_MANAGER': 'SAFETY_MANAGER', 
    'SAFETY_MANAGER': 'SAFETY_MANAGER',
    'DEPARTMENT_REP': 'DEP_REP',
    'DEP_REP': 'DEP_REP',
    'DEPARTMENT_MANAGER': 'DEP_MANAGER',
    'DEP_MANAGER': 'DEP_MANAGER',
    'HR_REP': 'HR_REP',
    'FINANCE_REP': 'FINANCE_REP',
    'SERVICE_PROVIDER_REP': 'SERVICE_PROVIDER_REP'
};

const importUsers = async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file' });
    if (!ADMIN_ROLES.includes(req.user.role)) return res.status(403).json({ message: 'Not authorized' });
    try {
        const wb = xlsx.readFile(req.file.path);
        const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        let added = 0, skipped = 0; const errors = [];
        
        for (const row of data) {
            // Find keys case-insensitively just in case
            const getVal = (keyStr) => {
                const key = Object.keys(row).find(k => k.toLowerCase() === keyStr.toLowerCase());
                return key ? row[key]?.toString().trim() : '';
            };

            const firstName = getVal('First Name');
            const fatherName = getVal('Father Name');
            const lastName = getVal('Last Name');
            const email = getVal('Email');
            const mobile = getVal('Mobile Number');
            const departmentName = getVal('Department');
            const roleInput = getVal('Role').toUpperCase();

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (!firstName || !lastName || !email || !roleInput || !departmentName) { errors.push(`Missing required data (First Name, Last Name, Email, Department, Role) for row: ${JSON.stringify(row)}`); continue; }
            if (!emailRegex.test(email)) { errors.push(`Invalid email format: ${email}`); continue; }
            
            const mappedRole = ROLE_MAP[roleInput];
            if (!mappedRole) { errors.push(`Invalid role for ${email}`); continue; }
            
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) { skipped++; continue; }
            
            // Map department
            let repDepartmentId = null;
            const dept = await prisma.department.findFirst({
                where: {
                    OR: [
                        { name: { equals: departmentName, mode: 'insensitive' } },
                        { nameAr: { equals: departmentName } }
                    ]
                }
            });
            if (!dept) { errors.push(`Department not found: ${departmentName} for ${email}`); continue; }
            repDepartmentId = dept.id;

            const name = [firstName, fatherName, lastName].filter(Boolean).join(' ');
            
            await prisma.user.create({ 
                data: { 
                    name, firstName, fatherName, lastName, email, password: '', 
                    role: mappedRole, userGroup: 'OFF_CIRCUIT', 
                    mobile: mobile || null, status: 'ACTIVE',
                    repDepartmentId 
                } 
            });
            added++;
        }
        res.json({ message: 'Done', summary: { total: data.length, added, skipped, errors } });
    } catch (error) {
        logger.error({ err: error }, 'Import Error:');
        res.status(500).json({ message: 'Error processing Excel file' });
    } finally {
        if (req.file && req.file.path) {
            try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore cleanup error */ }
        }
    }
};

const exportTickets = async (req, res) => {
    try {
        if (!ADMIN_ROLES.includes(req.user.role) && req.user.role !== 'OC_REPORTER' && req.user.role !== 'DEP_REP') return res.status(403).json({ message: 'Not authorized' });
        const { startDate, endDate, ticketId } = req.query;

        // SINGLE TICKET EXPORT
        if (ticketId) {
            const ticket = await prisma.ticket.findUnique({
                where: { id: ticketId },
                include: { createdBy: { select: { name: true } }, department: { select: { name: true } }, offCircuitReport: true, actionPlans: true, reminders: true }
            });
            if (!ticket) return res.status(404).json({ message: 'Not found' });
            const oc = ticket.offCircuitReport || {};
            const rows = [
                { 'Field': 'Ticket No', 'Value': ticket.ticketNo },
                { 'Field': 'Type', 'Value': ticket.type },
                { 'Field': 'Status', 'Value': ticket.status },
                { 'Field': 'Severity', 'Value': ticket.severityLevel || '-' },
                { 'Field': 'Reporter', 'Value': ticket.createdBy?.name || '-' },
                { 'Field': 'Department', 'Value': ticket.department?.name || '-' },
                { 'Field': 'Created At', 'Value': new Date(ticket.createdAt).toLocaleString() },
                { 'Field': 'Closed At', 'Value': ticket.closedAt ? new Date(ticket.closedAt).toLocaleString() : '-' },
                { 'Field': 'Closure Reason', 'Value': ticket.closureReason || '-' },
                { 'Field': '', 'Value': '' },
                { 'Field': '--- INCIDENT DETAILS ---', 'Value': '' },
                { 'Field': 'Date', 'Value': oc.incidentDate ? new Date(oc.incidentDate).toLocaleDateString() : '-' },
                { 'Field': 'Time', 'Value': oc.incidentTime || '-' },
                { 'Field': 'Location', 'Value': ticket.location || '-' },
                { 'Field': 'Description', 'Value': oc.whatHappened || '-' },
                { 'Field': 'Late Report Reason', 'Value': oc.lateReportReason || '-' },
                { 'Field': '', 'Value': '' },
                { 'Field': '--- RCA ---', 'Value': '' },
                { 'Field': 'Required?', 'Value': oc.rcaRequired ? 'Yes' : 'No' },
                { 'Field': 'Completed?', 'Value': oc.rcaCompleted ? 'Yes' : 'No' },
                { 'Field': 'Q1: Immediate Causes', 'Value': oc.rcaCause || '-' },
                { 'Field': 'Q2: Underlying Causes', 'Value': oc.rcaWhy || '-' },
                { 'Field': 'Q3: Root Causes', 'Value': oc.rcaRootCause || '-' },
                { 'Field': 'Q4: Corrective Actions', 'Value': oc.rcaCategory || '-' },
                { 'Field': 'Q5: Preventive Actions', 'Value': oc.rcaPreventiveActions || '-' },
                { 'Field': '', 'Value': '' },
                { 'Field': '--- GOSI / CONTRACTOR ---', 'Value': '' },
                { 'Field': 'GOSI Submitted?', 'Value': oc.gosiSubmitted !== null ? (oc.gosiSubmitted ? 'Yes' : 'No') : '-' },
                { 'Field': 'Employee ID', 'Value': oc.gosiEmployeeId || '-' },
                { 'Field': 'GOSI Number', 'Value': oc.gosiReportNumber || '-' },
                { 'Field': 'GOSI Reason (If No)', 'Value': oc.gosiNoReason || '-' },
                { 'Field': 'Contractor Notified?', 'Value': oc.contractorNotified !== null ? (oc.contractorNotified ? 'Yes' : 'No') : '-' },
                { 'Field': '', 'Value': '' },
                { 'Field': '--- ACTION PLANS ---', 'Value': '' }
            ];

            ticket.actionPlans.forEach((ap, i) => {
                rows.push({ 'Field': `Plan #${i+1} Type`, 'Value': ap.type });
                rows.push({ 'Field': `Plan #${i+1} Desc`, 'Value': ap.description });
                rows.push({ 'Field': `Plan #${i+1} Status`, 'Value': ap.status });
            });

            // H5: prevent formula injection in user-controlled cell values
            const ws = xlsx.utils.json_to_sheet(sanitizeRowsForExcel(rows));
            const wb = xlsx.utils.book_new(); xlsx.utils.book_append_sheet(wb, ws, 'Ticket Report');
            const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Disposition', `attachment; filename="${ticket.ticketNo}_Report.xlsx"`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            return res.send(buf);
        }

        // BULK EXPORT — Apply the same role-based scoping as getTickets to prevent
        // lower-privilege roles (OC_REPORTER, DEP_REP, etc.) from downloading data
        // they are not permitted to see through the normal ticket list view.
        const exportWhere = { userGroup: 'OFF_CIRCUIT' };
        if (req.user.role === 'OC_REPORTER') {
            exportWhere.createdById = req.user.id;
        } else if (req.user.role === 'DEP_REP' || req.user.role === 'DEP_MANAGER') {
            if (req.user.repDepartmentId) exportWhere.departmentId = req.user.repDepartmentId;
            else exportWhere.createdById = req.user.id; // fallback: own tickets only
        } else if (req.user.role === 'FINANCE_REP') {
            exportWhere.forwardedToFinance = true;
        }
        // ADMIN, HSE_CONTROLLER, SAFETY_MANAGER: no additional filter — full access
        if (startDate && endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            exportWhere.createdAt = { gte: new Date(startDate), lte: end };
        }

        const tickets = await prisma.ticket.findMany({ where: exportWhere, include: { createdBy: { select: { name: true } }, offCircuitReport: true, actionPlans: true }, orderBy: { createdAt: 'desc' } });
        const rows = tickets.map(t => {
            const oc = t.offCircuitReport;
            return {
                'Ticket No': t.ticketNo, 'Status': t.status, 'Type': t.type, 'Severity': oc?.severity || '', 'Injury': t.hasInjury ? 'Yes' : 'No',
                'Reporter': t.createdBy?.name || '', 'Description': oc?.whatHappened || '', 'Date': oc?.incidentDate ? new Date(oc.incidentDate).toLocaleDateString() : '',
                'Action Plans': t.actionPlans?.length || 0, 'Created': new Date(t.createdAt).toLocaleString(), 'Closed': t.closedAt ? new Date(t.closedAt).toLocaleString() : ''
            };
        });
        // H5: prevent formula injection in user-controlled cell values
        const ws = xlsx.utils.json_to_sheet(sanitizeRowsForExcel(rows));
        const wb = xlsx.utils.book_new(); xlsx.utils.book_append_sheet(wb, ws, 'Tickets');
        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', `attachment; filename="tickets_${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (error) { res.status(500).json({ message: 'Failed' }); }
};

module.exports = { getUsers, createUser, updateUser, suspendUser, toggleUserStatus, getAnalytics, downloadUserTemplate, importUsers, exportTickets };
