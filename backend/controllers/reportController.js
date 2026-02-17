const prisma = require('../prismaClient');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const xlsx = require('xlsx');

// === SAFE HELPERS ===
const safeString = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'number') {
        if (isNaN(val) || !isFinite(val)) return '';
        return String(val);
    }
    if (typeof val === 'string') return val;
    if (typeof val === 'boolean') return String(val);
    return '';
};

// Safe number helper - ensures no NaN reaches pdf-lib
const safeNumber = (val, fallback = 0) => {
    if (val === null || val === undefined) return fallback;
    const num = Number(val);
    if (isNaN(num) || !isFinite(num)) return fallback;
    return num;
};

// ASCII-safe date formatter (avoids locale-specific Unicode characters on Linux)
const safeDateString = (dateVal, includeTime = false) => {
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return 'N/A';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        if (!includeTime) return `${year}-${month}-${day}`;
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${mins}`;
    } catch (e) {
        return 'N/A';
    }
};

// Sanitize text for pdf-lib: strip any characters outside WinAnsi/Latin-1 encoding
// pdf-lib standard fonts only support WinAnsi (code points 32-255)
// Non-supported chars cause internal NaN when calculating character widths
const sanitizeForPdf = (text) => {
    if (!text) return '';
    // Replace common Unicode variants with ASCII equivalents
    let cleaned = String(text)
        .replace(/[\u00A0]/g, ' ')        // non-breaking space -> space
        .replace(/[\u2018\u2019]/g, "'")  // smart quotes -> apostrophe
        .replace(/[\u201C\u201D]/g, '"')  // smart double quotes -> quote
        .replace(/[\u2013\u2014]/g, '-')  // en-dash, em-dash -> hyphen
        .replace(/[\u2026]/g, '...')      // ellipsis -> three dots
        .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, ''); // zero-width & bidi chars
    // Strip any remaining chars outside printable ASCII + Latin-1 supplement (32-255)
    cleaned = cleaned.replace(/[^\x20-\xFF]/g, '?');
    return cleaned;
};

// @desc    Export ticket report to PDF
// @route   POST /api/tickets/:id/export-pdf
// @access  Private
const exportPdf = async (req, res) => {
    const ticketId = req.params.id;

    try {
        console.log('[PDF Export] Starting for ticket:', ticketId);

        // Fetch comprehensive data
        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
                createdBy: { select: { name: true, email: true, mobile: true } },
                medicalReport: true,
                controlReport: true,
                safetyReport: true,
                pitGridReport: true,
                attachments: true,
                activityLogs: {
                    include: { actor: { select: { name: true } } },
                    orderBy: { createdAt: 'desc' },
                    take: 20
                }
            }
        });

        if (!ticket) {
            console.log('[PDF Export] Ticket not found');
            return res.status(404).json({ message: 'Ticket not found' });
        }

        console.log('[PDF Export] Ticket loaded, creating PDF with pdf-lib');
        console.log('[PDF Export] Ticket fields debug:', {
            ticketNo: typeof ticket.ticketNo,
            type: typeof ticket.type,
            status: typeof ticket.status,
            priority: typeof ticket.priority,
            eventName: typeof ticket.eventName,
            location: typeof ticket.location,
            description: typeof ticket.description,
            hasMedical: !!ticket.medicalReport,
            hasPitGrid: !!ticket.pitGridReport,
            hasSafety: !!ticket.safetyReport,
            hasControl: !!ticket.controlReport
        });

        const verifyToken = Math.random().toString(36).substring(2, 10).toUpperCase();

        // Create PDF using pdf-lib
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const PAGE_WIDTH = 595;
        const PAGE_HEIGHT = 842;
        const MARGIN_TOP = 50;
        const MARGIN_BOTTOM = 50;
        const MARGIN_LEFT = 50;

        let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        let yPosition = PAGE_HEIGHT - MARGIN_TOP;

        // Helper to add a new page when needed
        const ensureSpace = (neededHeight) => {
            const needed = safeNumber(neededHeight, 20);
            if (yPosition < MARGIN_BOTTOM + needed) {
                currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
                yPosition = PAGE_HEIGHT - MARGIN_TOP;
            }
        };

        // Safe text drawing helper - ALL numeric values go through safeNumber
        const addText = (text, size, isBold) => {
            const safeSize = safeNumber(size, 10);
            const safeX = safeNumber(MARGIN_LEFT, 50);

            // Ensure we have space for this line
            ensureSpace(safeSize + 5);

            const safeY = safeNumber(yPosition, PAGE_HEIGHT - MARGIN_TOP);
            const safeText = sanitizeForPdf(safeString(String(text || '')));

            try {
                currentPage.drawText(safeText, {
                    x: safeX,
                    y: safeY,
                    size: safeSize,
                    font: isBold ? fontBold : font,
                    color: rgb(0, 0, 0),
                });
            } catch (drawError) {
                console.error(`[PDF Export] drawText error for text="${safeText}", x=${safeX}, y=${safeY}, size=${safeSize}:`, drawError.message);
                // Try drawing a fallback placeholder instead of crashing entirely
                try {
                    currentPage.drawText('[Error rendering text]', {
                        x: safeX,
                        y: safeY,
                        size: safeSize,
                        font: font,
                        color: rgb(0.5, 0, 0),
                    });
                } catch (e2) {
                    // Skip this line entirely
                    console.error('[PDF Export] Even fallback text failed:', e2.message);
                }
            }

            yPosition = safeNumber(safeY - safeSize - 5, 0);
        };

        // Helper for spacing
        const addSpacing = (amount) => {
            yPosition -= safeNumber(amount, 10);
        };

        // === HEADER ===
        addText('INCIDENT REPORT', 20, true);
        addText(`Ticket: ${safeString(ticket.ticketNo)}`, 12);
        addSpacing(10);

        // === BASIC INFO ===
        addText('BASIC INFORMATION', 14, true);
        addText(`Event: ${safeString(ticket.eventName)}`);
        addText(`Type: ${safeString(ticket.type)}`);
        addText(`Status: ${safeString(ticket.status)}`);
        addText(`Priority: ${safeString(ticket.priority)}`);
        addText(`Location: ${safeString(ticket.location)}`);
        addText(`Date: ${ticket.createdAt ? safeDateString(ticket.createdAt, true) : 'N/A'}`);
        addText(`Reporter: ${safeString(ticket.createdBy?.name)}`);
        addSpacing(10);

        // === DESCRIPTION ===
        addText('DESCRIPTION', 14, true);
        const description = safeString(ticket.description);
        if (description.length > 0) {
            // Split long text into lines
            const words = description.split(' ');
            let line = '';
            words.forEach(word => {
                const cleanWord = safeString(word);
                if (line.length + cleanWord.length < 80) {
                    line += cleanWord + ' ';
                } else {
                    if (line.trim()) addText(line.trim());
                    line = cleanWord + ' ';
                }
            });
            if (line.trim()) addText(line.trim());
        } else {
            addText('No description provided.');
        }
        addSpacing(10);

        // === MEDICAL REPORT ===
        if (ticket.medicalReport) {
            const m = ticket.medicalReport;
            console.log('[PDF Export] Medical report fields:', Object.keys(m).map(k => `${k}:${typeof m[k]}`).join(', '));
            addText('MEDICAL REPORT', 14, true);
            addText(`Patient: ${safeString(m.patientGivenName)} ${safeString(m.patientSurname)}`);
            addText(`DOB: ${m.patientDob ? safeDateString(m.patientDob) : 'N/A'}`);
            addText(`Gender: ${safeString(m.patientGender)}`);
            addText(`Role: ${safeString(m.patientRole)}`);
            addText(`Injury Type: ${safeString(m.injuryType)}`);
            addText(`License Action: ${safeString(m.licenseAction)}`);
            if (m.motorsportId) addText(`Motorsport ID: ${safeString(m.motorsportId)}`);
            if (m.carNumber) addText(`Car Number: ${safeString(m.carNumber)}`);
            addSpacing(10);
        }

        // === PIT GRID REPORT ===
        if (ticket.pitGridReport) {
            const p = ticket.pitGridReport;
            console.log('[PDF Export] PitGrid report fields:', Object.keys(p).map(k => `${k}:${typeof p[k]}=${p[k]}`).join(', '));
            addText('PIT & GRID REPORT', 14, true);
            addText(`Car Number: ${safeString(p.carNumber)}`);
            addText(`Pit Number: ${safeString(p.pitNumber)}`);
            addText(`Session: ${safeString(p.sessionCategory)}`);
            if (p.lapNumber !== null && p.lapNumber !== undefined) {
                addText(`Lap Number: ${safeString(p.lapNumber)}`);
            }
            if (p.speedLimit) addText(`Speed Limit: ${safeString(p.speedLimit)}`);
            if (p.speedRecorded) addText(`Speed Recorded: ${safeString(p.speedRecorded)}`);
            addSpacing(10);
        }

        // === SAFETY REPORT ===
        if (ticket.safetyReport) {
            const s = ticket.safetyReport;
            addText('SAFETY REPORT', 14, true);
            if (s.hazardType) addText(`Hazard Type: ${safeString(s.hazardType)}`);
            if (s.locationDetail) addText(`Location Detail: ${safeString(s.locationDetail)}`);
            if (s.trackStatus) addText(`Track Status: ${safeString(s.trackStatus)}`);
            if (s.damageDescription) addText(`Damage: ${safeString(s.damageDescription)}`);
            addSpacing(10);
        }

        // === CONTROL REPORT ===
        if (ticket.controlReport) {
            const c = ticket.controlReport;
            addText('CONTROL REPORT', 14, true);
            if (c.competitorNumber) addText(`Competitor Number: ${safeString(c.competitorNumber)}`);
            if (c.lapNumber !== null && c.lapNumber !== undefined) addText(`Lap Number: ${safeString(c.lapNumber)}`);
            if (c.violationType) addText(`Violation Type: ${safeString(c.violationType)}`);
            if (c.actionTaken) addText(`Action Taken: ${safeString(c.actionTaken)}`);
            if (c.penaltyValue) addText(`Penalty: ${safeString(c.penaltyValue)}`);
            if (c.reasoning) addText(`Reasoning: ${safeString(c.reasoning)}`);
            addSpacing(10);
        }

        // === VERIFICATION ===
        addText('VERIFICATION', 12, true);
        addText(`Token: ${verifyToken}`, 8);
        addText(`Generated: ${new Date().toISOString()}`, 8);

        // Save PDF
        console.log('[PDF Export] All text drawn, saving PDF...');
        const pdfBytes = await pdfDoc.save();

        console.log('[PDF Export] PDF created successfully, size:', pdfBytes.length);

        const fileName = `report-${safeString(ticket.ticketNo)}.pdf`;
        const contentLength = safeNumber(pdfBytes.length, 0);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        if (contentLength > 0) {
            res.setHeader('Content-Length', contentLength);
        }
        res.send(Buffer.from(pdfBytes));

        // Save export record
        try {
            await prisma.ticketExport.create({
                data: {
                    ticketId,
                    verifyToken,
                    pdfUrl: 'BUFFERED',
                    snapshotJson: JSON.stringify({ id: ticket.id, ticketNo: ticket.ticketNo })
                }
            });
        } catch (e) {
            console.error('Export log error:', e);
        }

    } catch (error) {
        console.error("[PDF Export Error]:", error);
        console.error("[PDF Export Error Stack]:", error.stack);
        if (!res.headersSent) {
            res.status(500).json({ message: `Export failed: ${error.message}` });
        }
    }
};

// @desc    Export tickets to Excel
// @route   GET /api/tickets/export-excel
// @access  Private (Admin/COC)
const exportExcel = async (req, res) => {
    try {
        console.log('[Excel Export] Starting export');
        const { startDate, endDate } = req.query;

        // 1. Validation & Filter
        const where = {};
        if (startDate && endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            where.createdAt = {
                gte: new Date(startDate),
                lte: end
            };
        }

        // 2. Fetch Data
        const tickets = await prisma.ticket.findMany({
            where,
            include: {
                createdBy: true,
                medicalReport: true,
                pitGridReport: true
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`[Excel Export] Found ${tickets.length} tickets`);

        if (!tickets || tickets.length === 0) {
            return res.status(404).json({ message: 'No tickets found for the selected range.' });
        }

        // 3. Transform Data for Excel
        const data = tickets.map(t => ({
            'Ticket No': safeString(t.ticketNo),
            'Event': safeString(t.eventName),
            'Open Date': t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '',
            'Closed Date': t.closedAt ? new Date(t.closedAt).toLocaleDateString() : '-',
            'Type': safeString(t.type),
            'Status': safeString(t.status),
            'Priority': safeString(t.priority),
            'Reporter': safeString(t.createdBy?.name) || 'Unknown',
            'Description': safeString(t.description),
            'Assigned To': safeString(t.assignedToId) || 'Unassigned',

            // Medical Specifics
            'Patient Name': t.medicalReport
                ? `${safeString(t.medicalReport.patientGivenName)} ${safeString(t.medicalReport.patientSurname)}`.trim()
                : '',
            'Injury Type': safeString(t.medicalReport?.injuryType),
            'License Action': safeString(t.medicalReport?.licenseAction),

            // Pit Specifics
            'Car No': safeString(t.pitGridReport?.carNumber) || safeString(t.medicalReport?.carNumber),
            'Pit Violation': t.pitGridReport ? [
                t.pitGridReport.drivingOnWhiteLine ? 'White Line' : '',
                t.pitGridReport.refueling ? 'Refueling' : '',
                t.pitGridReport.excessMechanics ? 'Excess Mechanics' : ''
            ].filter(Boolean).join(', ') : ''
        }));

        // 4. Create Workbook
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'Tickets');

        // 5. Generate Buffer (In-Memory)
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        console.log('[Excel Export] Buffer created, sending response');

        // 6. Send Response
        const fileName = `tickets_export_${Date.now()}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', buffer.length);

        res.send(buffer);

    } catch (error) {
        console.error('[Excel Export Error]:', error);
        console.error(error.stack);
        res.status(500).json({ message: `Excel export failed: ${error.message}` });
    }
};

// @desc    Verify a report via QR token
// @route   GET /api/verify/:token
// @access  Public
const verifyReport = async (req, res) => {
    const { token } = req.params;

    try {
        const exportRecord = await prisma.ticketExport.findUnique({
            where: { verifyToken: token },
            include: { ticket: { include: { createdBy: { select: { name: true } } } } }
        });

        if (!exportRecord) {
            return res.status(404).json({ valid: false, message: 'Invalid or expired report token' });
        }

        res.json({
            valid: true,
            ticketNo: exportRecord.ticket.ticketNo,
            type: exportRecord.ticket.type,
            status: exportRecord.ticket.status,
            createdAt: exportRecord.ticket.createdAt,
            reporter: exportRecord.ticket.createdBy.name
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { exportPdf, exportExcel, verifyReport };
