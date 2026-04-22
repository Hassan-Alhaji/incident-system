const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

async function seed() {
    // Get existing user IDs using raw query
    const users = await prisma.$queryRawUnsafe(`SELECT id, name, role FROM "User" LIMIT 10`);
    const adminUser = users.find(u => u.role === 'ADMIN') || users[0];
    const hseUser = users.find(u => u.role === 'HSE_CONTROLLER');
    
    if (!adminUser) { console.error('No users!'); process.exit(1); }
    console.log(`Using creator: ${adminUser.name} (${adminUser.role})`);

    // Get last ticket counter
    const lastTicket = await prisma.$queryRawUnsafe(`SELECT "ticketNo" FROM "Ticket" WHERE "userGroup"='OFF_CIRCUIT' ORDER BY "ticketNo" DESC LIMIT 1`);
    let counter = lastTicket.length > 0 ? parseInt(lastTicket[0].ticketNo.split('-').pop()) + 1 : 2;

    const statuses = ['OPEN', 'HSE_REVIEW', 'UNDER_INVESTIGATION', 'PENDING_DEP_REP', 'FINAL_REVIEW', 'CLOSED', 'CLOSED_REJECTED'];
    const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const locations = [
        'Main Workshop - Building A', 'Warehouse Section 3', 'Parking Lot B2', 
        'Office Building - 2nd Floor', 'Chemical Storage Area', 'Loading Dock 5',
        'Cafeteria Kitchen', 'Electrical Room E1', 'Construction Site - Zone C',
        'Main Gate Security Post', 'Server Room', 'Assembly Line 2', 'Quality Lab'
    ];
    const descriptions = [
        'سقط عامل من السلم أثناء أعمال الصيانة وأصيب بكسر في الذراع الأيمن',
        'Worker slipped on wet floor near the chemical storage and hit his head',
        'إصابة موظف بحروق طفيفة أثناء عملية اللحام بسبب عدم ارتداء القفازات الواقية',
        'Forklift operator collided with a stack of pallets causing minor injuries to nearby worker',
        'انهيار جزء من السقالة أدى إلى إصابة عاملين بجروح متوسطة',
        'Electrical shock incident during maintenance work on the main panel',
        'تسرب مادة كيميائية أدى إلى إصابة ثلاثة عمال بتهيج في الجلد والعينين',
        'Heavy object fell from shelf striking an employee on the shoulder',
        'إصابة موظف بالظهر أثناء رفع حمولة ثقيلة بطريقة خاطئة',
        'Vehicle accident in the parking area resulted in minor injuries to the driver',
        'اشتعال نار صغيرة في مخزن المواد أدى إلى إصابة عامل بحروق بسيطة',
        'Machine guard was removed causing finger injury to the operator',
        'تعرض عامل لضربة شمس أثناء العمل في المنطقة المكشوفة',
        'Crane cable snapped causing load to fall near workers - near miss with minor scrapes',
        'انزلاق عامل على سطح زيتي في منطقة الورشة مما أدى لكسر في الكاحل',
        'Pressurized hose burst spraying hot water on two technicians',
        'سقوط أدوات من الطابق العلوي أصابت عامل في الرأس - نقل للمستشفى',
        'Worker caught hand in conveyor belt mechanism - finger laceration',
        'تعطل نظام التهوية أدى لاستنشاق أبخرة سامة من قبل 4 موظفين',
        'Glass panel shattered during installation cutting worker on forearm',
        'اصطدام رافعة شوكية بعمود خرساني أدى لانقلابها وإصابة السائق',
        'Scaffolding collapse at construction zone resulted in two workers injured',
        'حريق صغير في الكافتيريا بسبب ماس كهربائي - لا إصابات خطيرة',
        'Worker tripped over exposed cable and fell into excavation pit',
        'إصابة فني أثناء فحص المعدات الكهربائية بصعقة كهربائية خفيفة'
    ];
    const injuredNames = [
        'محمد الحربي', 'أحمد العتيبي', 'خالد الشمري', 'فهد القحطاني',
        'عبدالله المطيري', 'سعد الدوسري', 'عمر الغامدي', 'يوسف الزهراني',
        'ناصر البقمي', 'سلطان العنزي', 'ماجد الشهري', 'بندر الحارثي',
        'فيصل المالكي', 'راشد السبيعي', 'تركي العمري', 'عادل الرشيدي',
        'حسن الأحمري', 'زياد المحمدي', 'مشاري الخالدي', 'طارق النفيعي'
    ];
    const affiliates = ['موظف', 'مقاول', 'زائر', 'متدرب', 'مزود خدمة'];
    const depts = ['الصيانة', 'الإنتاج', 'المستودعات', 'الأمن', 'تقنية المعلومات'];
    const incidentTypes = ['INJURY', 'NEAR_MISS', 'PROPERTY_DAMAGE', 'FIRE', 'HEALTH', 'VIOLATION'];
    const analysisMethods = ['5-Why', 'Fishbone', 'Fault Tree', 'Bowtie'];

    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    let created = 0;

    for (let i = 0; i < 25; i++) {
        const ticketNo = `OC-2026-${String(counter++).padStart(5, '0')}`;
        const status = pick(statuses);
        const priority = pick(priorities);
        const incType = i < 15 ? 'INJURY' : pick(incidentTypes);
        const hasInjury = incType === 'INJURY' || Math.random() > 0.4;
        const severity = pick(severities);
        const location = pick(locations);
        const desc = descriptions[i % descriptions.length];

        const daysAgo = rand(1, 90);
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - daysAgo);
        createdAt.setHours(rand(6, 20), rand(0, 59), rand(0, 59));

        const incidentDate = new Date(createdAt);
        incidentDate.setHours(incidentDate.getHours() - rand(0, 3));

        const closedAt = (status === 'CLOSED' || status === 'CLOSED_REJECTED')
            ? new Date(createdAt.getTime() + rand(1, 7) * 24 * 60 * 60 * 1000)
            : null;

        const sevLevel = severity === 'CRITICAL' ? 'RED' : severity === 'HIGH' ? 'YELLOW' : 'GREEN';
        const incTime = `${String(rand(6, 20)).padStart(2, '0')}:${String(rand(0, 59)).padStart(2, '0')}`;

        // Build injured persons JSON
        const numInjured = hasInjury ? rand(1, 3) : 0;
        const injured = [];
        for (let j = 0; j < numInjured; j++) {
            injured.push({
                name: injuredNames[(i * 3 + j) % injuredNames.length],
                affiliate: pick(affiliates),
                contact: `+9665${String(rand(10000000, 99999999))}`,
                dept: pick(depts),
                jobTitle: pick(['فني', 'عامل', 'مهندس', 'مشرف', 'سائق']),
                empNumber: `EMP-${String(rand(1000, 9999))}`
            });
        }
        const witnesses = [{ name: injuredNames[(i + 7) % injuredNames.length], mobile: `+9665${String(rand(10000000, 99999999))}` }];

        const isAdvanced = ['UNDER_INVESTIGATION', 'FINAL_REVIEW', 'CLOSED', 'CLOSED_REJECTED'].includes(status);
        const isClosed = ['CLOSED', 'CLOSED_REJECTED'].includes(status);

        const riskL = rand(1, 5), riskC = rand(1, 5), riskScore = riskL * riskC;
        const riskLevel = riskScore >= 15 ? 'EXTREME' : riskScore >= 10 ? 'HIGH' : riskScore >= 5 ? 'MEDIUM' : 'LOW';

        const ticketId = crypto.randomUUID();
        const ocReportId = crypto.randomUUID();

        try {
            // Insert Ticket via raw SQL
            await prisma.$executeRawUnsafe(`
                INSERT INTO "Ticket" (id, "ticketNo", type, status, priority, "userGroup", description, location, 
                    "hasInjury", "incidentDate", "incidentTime", "createdById", "assignedToId", 
                    "closedAt", "closureReason", "severityLevel", "createdAt", "updatedAt")
                VALUES ($1, $2, 'INJURY'::"TicketType", $3::"TicketStatus", $4::"Priority", 'OFF_CIRCUIT', $5, $6, 
                    $7, $8, $9, $10, $11, 
                    $12, $13, $14, $15, $15)`,
                ticketId, ticketNo, status, priority, desc, location,
                hasInjury, incidentDate, incTime, adminUser.id, hseUser?.id || null,
                closedAt, isClosed ? 'Investigation completed' : null, sevLevel, createdAt
            );

            // Insert OffCircuitReport
            const ctrlAt = new Date(createdAt.getTime() + 2 * 3600000);
            const invAt = new Date(createdAt.getTime() + 48 * 3600000);

            await prisma.$executeRawUnsafe(`
                INSERT INTO "OffCircuitReport" (id, "ticketId", "incidentType", "incidentDate", "incidentTime",
                    "locationAddress", "locationLat", "locationLng", "whatHappened", "hasInjury", severity,
                    "injuredPersons", witnesses, "reporterFilledBy", "reporterFilledAt",
                    "isLTI", "isMaterialDamage", "isRegulatoryReportable", "isNearMiss",
                    "controllerFilledBy", "controllerFilledAt",
                    "immediateCauses", "preventiveActions", "underlyingCauses", "rootCauses", "analysisMethod",
                    "riskLikelihood", "riskConsequence", "riskScore", "riskLevel",
                    "investigatorFilledBy", "investigatorFilledAt",
                    "finalDecision", "finalNotes", "hseManagerFilledBy", "hseManagerFilledAt",
                    "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5,
                    $6, $7, $8, $9, $10, $11,
                    $12, $13, $14, $15,
                    $16, $17, $18, $19,
                    $20, $21,
                    $22, $23, $24, $25, $26,
                    $27, $28, $29, $30,
                    $31, $32,
                    $33, $34, $35, $36,
                    $37, $37)`,
                ocReportId, ticketId, incType, incidentDate, incTime,
                location, 24.7 + Math.random() * 0.1, 46.6 + Math.random() * 0.1, desc, hasInjury, severity,
                hasInjury ? JSON.stringify(injured) : null, JSON.stringify(witnesses), 'Hassan Alhaji', createdAt,
                // Controller fields
                (isAdvanced || status === 'HSE_REVIEW') ? (hasInjury && Math.random() > 0.5) : null,
                (isAdvanced || status === 'HSE_REVIEW') ? (Math.random() > 0.6) : null,
                (isAdvanced || status === 'HSE_REVIEW') ? (severity === 'CRITICAL') : null,
                (isAdvanced || status === 'HSE_REVIEW') ? (incType === 'NEAR_MISS') : null,
                (isAdvanced || status === 'HSE_REVIEW') ? 'HSE Controller' : null,
                (isAdvanced || status === 'HSE_REVIEW') ? ctrlAt : null,
                // Investigation fields
                isAdvanced ? 'عدم اتباع إجراءات السلامة - Failure to follow safety procedures' : null,
                isAdvanced ? 'تدريب إضافي وتفعيل نظام المراقبة - Additional training and monitoring' : null,
                isAdvanced ? 'نقص في التدريب - Insufficient training' : null,
                isAdvanced ? 'غياب ثقافة السلامة - Lack of safety culture' : null,
                isAdvanced ? pick(analysisMethods) : null,
                isAdvanced ? riskL : null, isAdvanced ? riskC : null,
                isAdvanced ? riskScore : null, isAdvanced ? riskLevel : null,
                isAdvanced ? 'Safety Investigator' : null, isAdvanced ? invAt : null,
                // Final decision
                isClosed ? (status === 'CLOSED' ? 'APPROVE' : 'REJECT') : null,
                isClosed ? (status === 'CLOSED' ? 'تم التحقق من الإجراءات - All actions verified' : 'مكررة - Duplicate') : null,
                isClosed ? 'HSE Manager' : null, isClosed ? closedAt : null,
                createdAt
            );

            created++;
            console.log(`✅ ${ticketNo} | ${status.padEnd(22)} | ${priority.padEnd(8)} | ${hasInjury ? '🩹' : '✓ '} | ${daysAgo}d ago`);
        } catch (err) {
            console.error(`❌ ${ticketNo}:`, err.message?.substring(0, 120));
        }
    }

    console.log(`\n🎉 Created ${created}/25 tickets!`);
    await prisma.$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
