const prisma = require('../prismaClient');
const xlsx = require('xlsx');
const fs = require('fs');
const { ROLES, ADMIN_ROLES } = require('./ticketCrud');
const logger = require('../lib/logger').child({ module: 'ticketAdmin' });

const OC_USER_ROLES = ['OC_REPORTER','HSE_CONTROLLER','DEP_REP','DEP_MANAGER','SAFETY_MANAGER','OC_HSE_MANAGER','HR_REP','SERVICE_PROVIDER_REP'];

const getUsers = async (req, res) => {
    try {
        if (!ADMIN_ROLES.includes(req.user.role)) return res.status(403).json({ message: 'Not authorized' });
        const users = await prisma.user.findMany({
            where: { role: { in: [...OC_USER_ROLES, 'ADMIN'] } },
            select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, mobile: true, canCloseTickets: true, canPerformRCA: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(users);
    } catch (error) { res.status(500).json({ message: 'Error fetching users' }); }
};

const createUser = async (req, res) => {
    try {
        if (!ADMIN_ROLES.includes(req.user.role)) return res.status(403).json({ message: 'Not authorized' });
        const { name, email, role, mobile, canCloseTickets, canPerformRCA } = req.body;
        if (!name || !email) return res.status(400).json({ message: 'Name and email required' });
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(400).json({ message: 'Email exists' });
        const parts = name.trim().split(/\s+/);
        const firstName = parts[0] || '';
        const lastName = parts.length > 1 ? parts.slice(-1)[0] : '';
        const fatherName = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';

        const user = await prisma.user.create({
            data: { name, firstName, fatherName, lastName, email, password: '', role: role || 'OC_REPORTER', userGroup: 'OFF_CIRCUIT', mobile: mobile || null, status: 'ACTIVE', canCloseTickets: canCloseTickets || false, canPerformRCA: canPerformRCA || false }
        });
        res.status(201).json({ message: 'User created', user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

const updateUser = async (req, res) => {
    try {
        if (!ADMIN_ROLES.includes(req.user.role)) return res.status(403).json({ message: 'Not authorized' });
        const { name, email, role, mobile, canCloseTickets, canPerformRCA } = req.body;
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
        data.userGroup = 'OFF_CIRCUIT';
        const user = await prisma.user.update({ where: { id: req.params.id }, data });
        res.json({ message: 'Updated', user: { id: user.id, name: user.name, role: user.role } });
    } catch (error) { res.status(500).json({ message: 'Error updating user' }); }
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
        await prisma.user.update({ where: { id: req.params.id }, data: { status: req.body.status } });
        res.json({ message: `Status updated to ${req.body.status}` });
    } catch (error) { res.status(500).json({ message: 'Error' }); }
};

// ════════════════════════════════════════════════════════════════════════════
// HSE ANALYTICS — Best-practice manager dashboard
// Saudi industrial pyramid ratio: 1 LTI : 10 Medical : 30 Near-Miss : 100 Observation
// LTI definition: type === LOST_TIME_INJURY OR severityLevel ∈ {MAJOR, SEVERE, CRITICAL, SERIOUS}
// ════════════════════════════════════════════════════════════════════════════
const HIGH_SEVERITY = new Set(['MAJOR', 'SEVERE', 'CRITICAL', 'SERIOUS']);
const LOW_SEVERITY  = new Set(['MINOR', 'MODERATE', 'SIGNIFICANT']);
const PYRAMID_RATIO = { lti: 1, medical: 10, nearMiss: 30, observation: 100 }; // Saudi industrial

// Classify a ticket into the pyramid level for HSE reporting
const classifyPyramid = (t) => {
    const type = t.type || '';
    const sev  = t.severityLevel || '';

    // Security incidents don't typically count in the HSE safety pyramid
    if (type === 'SECURITY') return 'other';

    // 1. Fatality
    if (sev === 'FATAL' || type === 'FATALITY') return 'fatality';

    // 2. Injuries / Actual Incidents
    if (t.hasInjury || type === 'ACCIDENT') {
        if (HIGH_SEVERITY.has(sev)) return 'lti';
        return 'medical';
    }

    // 3. Proactive / No Injury
    // A high-severity observation without injury is considered a Near-Miss
    if (HIGH_SEVERITY.has(sev) || type === 'NEAR_MISS') return 'nearMiss';

    // Normal observation
    if (type === 'OBSERVATION' || ['UNSAFE_ACT', 'UNSAFE_CONDITION'].includes(type)) return 'observation';

    // Fallback
    return 'observation';
};

const getAnalytics = async (req, res) => {
    try {
        if (!ROLES.ALL.includes(req.user.role)) return res.status(403).json({ message: 'Not authorized' });

        // Date range filter from query params
        const { from, to } = req.query;
        const where = { userGroup: 'OFF_CIRCUIT' };
        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from);
            if (to) {
                const endDate = new Date(to);
                endDate.setHours(23, 59, 59, 999); // Include the entire "to" day
                where.createdAt.lte = endDate;
            }
        }

        // Fetch everything in parallel ────────────────────────────────────────
        const [tickets, actionPlans, departments, serviceProviders] = await Promise.all([
            prisma.ticket.findMany({
                where,
                select: {
                    id: true, type: true, status: true, priority: true, hasInjury: true,
                    severityLevel: true, createdAt: true, closedAt: true, createdById: true,
                    departmentId: true, zoneId: true, serviceProviderId: true, location: true, ticketNo: true,
                    department: { select: { id: true, name: true, nameAr: true } },
                    zone: { select: { id: true, name: true } },
                    serviceProvider: { select: { id: true, name: true, commercialRegistrationNumber: true, status: true, department: { select: { name: true, nameAr: true } } } },
                    offCircuitReport: { select: { isLateReport: true, rcaRequired: true, rcaCompleted: true, gosiSubmitted: true, contractorNotified: true, locationLat: true, locationLng: true } },
                },
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

            // Map Cases
            mapCases: tickets.map(t => ({
                id: t.id,
                ticketNo: t.ticketNo,
                status: t.status,
                severityLevel: t.severityLevel || t.offCircuitReport?.severity || 'MINOR',
                locationLat: t.offCircuitReport?.locationLat || null,
                locationLng: t.offCircuitReport?.locationLng || null,
                location: t.location
            })),

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
            { name: 'Ahmed', email: 'ahmed@co.com', mobile: '+966500000000', role: 'REPORTER' },
        ]);
        const wb = xlsx.utils.book_new(); xlsx.utils.book_append_sheet(wb, ws, 'Users');
        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename="template.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (error) { res.status(500).json({ message: 'Failed' }); }
};

const ROLE_MAP = { 'REPORTER': 'OC_REPORTER', 'OC_REPORTER': 'OC_REPORTER', 'CONTROLLER': 'HSE_CONTROLLER', 'HSE_CONTROLLER': 'HSE_CONTROLLER', 'HSE_MANAGER': 'SAFETY_MANAGER', 'SAFETY_MANAGER': 'SAFETY_MANAGER' };

const importUsers = async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file' });
    if (!ADMIN_ROLES.includes(req.user.role)) return res.status(403).json({ message: 'Not authorized' });
    try {
        const wb = xlsx.readFile(req.file.path);
        const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        let added = 0, skipped = 0; const errors = [];
        for (const row of data) {
            const email = row['email']?.toString().trim();
            const name = row['name']?.toString().trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const nameRegex = /^[a-zA-Z\s\-']+$/;
            
            if (!email || !name) { errors.push(`Missing data: ${JSON.stringify(row)}`); continue; }
            if (!emailRegex.test(email)) { errors.push(`Invalid email format: ${email}`); continue; }
            if (!nameRegex.test(name)) { errors.push(`Invalid name format (English letters only): ${name}`); continue; }
            
            const mappedRole = ROLE_MAP[row['role']?.toString().trim().toUpperCase()];
            if (!mappedRole) { errors.push(`Invalid role for ${email}`); continue; }
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) { skipped++; continue; }
            
            const parts = name.split(/\s+/);
            const firstName = parts[0] || '';
            const lastName = parts.length > 1 ? parts.slice(-1)[0] : '';
            const fatherName = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';
            
            await prisma.user.create({ data: { name, firstName, fatherName, lastName, email, password: '', role: mappedRole, userGroup: 'OFF_CIRCUIT', mobile: row['mobile']?.toString() || null, status: 'ACTIVE' } });
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

            const ws = xlsx.utils.json_to_sheet(rows);
            const wb = xlsx.utils.book_new(); xlsx.utils.book_append_sheet(wb, ws, 'Ticket Report');
            const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Disposition', `attachment; filename="${ticket.ticketNo}_Report.xlsx"`);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            return res.send(buf);
        }

        // BULK EXPORT
        let where = { userGroup: 'OFF_CIRCUIT' };
        if (startDate && endDate) { const end = new Date(endDate); end.setHours(23,59,59,999); where.createdAt = { gte: new Date(startDate), lte: end }; }

        const tickets = await prisma.ticket.findMany({ where, include: { createdBy: { select: { name: true } }, offCircuitReport: true, actionPlans: true }, orderBy: { createdAt: 'desc' } });
        const rows = tickets.map(t => {
            const oc = t.offCircuitReport;
            return {
                'Ticket No': t.ticketNo, 'Status': t.status, 'Type': t.type, 'Severity': oc?.severity || '', 'Injury': t.hasInjury ? 'Yes' : 'No',
                'Reporter': t.createdBy?.name || '', 'Description': oc?.whatHappened || '', 'Date': oc?.incidentDate ? new Date(oc.incidentDate).toLocaleDateString() : '',
                'Action Plans': t.actionPlans?.length || 0, 'Created': new Date(t.createdAt).toLocaleString(), 'Closed': t.closedAt ? new Date(t.closedAt).toLocaleString() : ''
            };
        });
        const ws = xlsx.utils.json_to_sheet(rows);
        const wb = xlsx.utils.book_new(); xlsx.utils.book_append_sheet(wb, ws, 'Tickets');
        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', `attachment; filename="tickets_${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (error) { res.status(500).json({ message: 'Failed' }); }
};

module.exports = { getUsers, createUser, updateUser, suspendUser, toggleUserStatus, getAnalytics, downloadUserTemplate, importUsers, exportTickets };
