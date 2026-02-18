const prisma = require('../prismaClient');
const PDFDocument = require('pdfkit');
const xlsx = require('xlsx');

// ── Helpers ──────────────────────────────────────────────────────────────────

const safe = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'number') return isNaN(val) || !isFinite(val) ? '' : String(val);
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
};

const formatDate = (d, time = false) => {
    try {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return 'N/A';
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');
        if (!time) return `${y}-${m}-${day}`;
        const h = String(dt.getHours()).padStart(2, '0');
        const min = String(dt.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${day} ${h}:${min}`;
    } catch { return 'N/A'; }
};

// Aggressively strip EVERYTHING except basic printable ASCII (32-126) for safety
const clean = (text) => {
    if (!text) return '';
    return String(text).replace(/[^ -~]/g, '');
};

// ── PDF Export (PDFKit) ──────────────────────────────────────────────────────

const exportPdf = async (req, res) => {
    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id: req.params.id },
            include: {
                createdBy: { select: { name: true, email: true } },
                medicalReport: true,
                controlReport: true,
                safetyReport: true,
                pitGridReport: true,
                activityLogs: {
                    include: { actor: { select: { name: true } } },
                    orderBy: { createdAt: 'desc' },
                    take: 20
                }
            }
        });

        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        // Setup streaming response
        // Note: We don't verify token link in the footer anymore since we generate it on download
        const verifyToken = Math.random().toString(36).substring(2, 10).toUpperCase();

        const fileName = `report-${clean(safe(ticket.ticketNo))}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        // Pipe to response
        doc.pipe(res);

        // Also capture buffer for internal storage (TicketExport)
        const buffers = [];
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', async () => {
            try {
                const pdfData = Buffer.concat(buffers);
                await prisma.ticketExport.create({
                    data: {
                        ticketId: req.params.id,
                        verifyToken: verifyToken,
                        pdfUrl: 'BUFFERED',
                        snapshotJson: JSON.stringify({ id: ticket.id, ticketNo: ticket.ticketNo })
                    }
                });
            } catch (e) { console.error('Export Log Error:', e); }
        });

        // ── Styles ───────────────────────────────────────────────────────────
        const fontBold = 'Helvetica-Bold';
        const fontRegular = 'Helvetica';

        // ── Header ───────────────────────────────────────────────────────────

        // Green header bar
        doc.rect(0, 0, 595, 100).fill('#2e7d32');

        doc.fontSize(24).font(fontBold).fill('white').text('INCIDENT REPORT', 50, 35);
        doc.fontSize(12).font(fontRegular).fill('#e8f5e9').text(`Ticket #${safe(ticket.ticketNo)}`, 50, 65);

        // Status badge
        const status = safe(ticket.status).toUpperCase().replace(/_/g, ' ');
        doc.fontSize(12).font(fontBold).fill('white').text(status, 400, 45, { width: 145, align: 'right' });

        doc.y = 130;
        doc.fill('#1a1a1a');

        // ── Helpers for Content ──────────────────────────────────────────────

        const drawSection = (title) => {
            doc.moveDown(1.5);
            doc.fontSize(14).font(fontBold).fill('#2e7d32').text(title.toUpperCase());
            doc.rect(doc.x, doc.y + 2, 495, 1).fill('#e0e0e0'); // Underline
            doc.moveDown(0.8);
            doc.fill('#1a1a1a');
        };

        const drawField = (label, value) => {
            if (!value && value !== 0) return;
            const startY = doc.y;
            doc.fontSize(10).font(fontBold).fill('#666666').text(clean(safe(label)) + ':', { width: 130, continued: false });

            // Move cursor up to draw value on same line
            doc.text(clean(safe(value)), 180, startY, { width: 360 });
            doc.moveDown(0.3);
        };

        const drawText = (text) => {
            if (!text) return;
            doc.fontSize(10).font(fontRegular).fill('#1a1a1a').text(clean(safe(text)), { width: 495, align: 'justify' });
            doc.moveDown(0.5);
        };

        // ── Body ─────────────────────────────────────────────────────────────

        drawSection('Basic Information');
        drawField('Event', ticket.eventName);
        drawField('Type', ticket.type);
        drawField('Priority', ticket.priority);
        drawField('Location', ticket.location || 'N/A');
        drawField('Date', ticket.incidentDate ? formatDate(ticket.incidentDate) : formatDate(ticket.createdAt));
        drawField('Time', ticket.incidentTime || 'N/A');
        drawField('Reporter', ticket.createdBy?.name || ticket.reporterName || 'N/A');
        if (ticket.postNumber) drawField('Post Number', ticket.postNumber);
        if (ticket.marshalId) drawField('Marshal ID', ticket.marshalId);

        drawSection('Description');
        if (ticket.description) drawText(ticket.description);
        else doc.fontSize(10).fill('#999').text('No description provided.');

        if (ticket.medicalReport) {
            const m = ticket.medicalReport;
            drawSection('Medical Report');
            drawField('Patient', `${safe(m.patientGivenName)} ${safe(m.patientSurname)}`);
            drawField('DOB', m.patientDob ? formatDate(m.patientDob) : 'N/A');
            drawField('Gender', m.patientGender);
            drawField('Role', m.patientRole);
            if (m.motorsportId) drawField('Motorsport ID', m.motorsportId);
            if (m.carNumber) drawField('Car Number', m.carNumber);
            drawField('Injury Type', m.injuryType);
            drawField('License Action', m.licenseAction);
            if (m.treatmentLocation) drawField('Treatment Location', m.treatmentLocation);
            if (m.arrivalMethod) drawField('Arrival Method', m.arrivalMethod);
            if (m.initialCondition) drawField('Initial Condition', m.initialCondition);
            if (m.treatmentGiven) drawField('Treatment Given', m.treatmentGiven);

            if (m.summary) {
                doc.moveDown(0.5);
                doc.font(fontBold).text('Summary:');
                drawText(m.summary);
            }
            if (m.recommendation) {
                doc.moveDown(0.5);
                doc.font(fontBold).text('Recommendation:');
                drawText(m.recommendation);
            }
        }

        if (ticket.pitGridReport) {
            const p = ticket.pitGridReport;
            drawSection('Pit & Grid Report');
            if (p.sessionCategory) drawField('Session', p.sessionCategory);
            if (p.teamName) drawField('Team', p.teamName);
            if (p.carNumber) drawField('Car Number', p.carNumber);
            if (p.driverName) drawField('Driver', p.driverName);
            if (p.pitNumber) drawField('Pit Number', p.pitNumber);
            if (p.lapNumber !== null && p.lapNumber !== undefined) drawField('Lap Number', p.lapNumber);
            if (p.speedLimit) drawField('Speed Limit', p.speedLimit);
            if (p.speedRecorded) drawField('Speed Recorded', p.speedRecorded);

            const violations = [];
            if (p.drivingOnWhiteLine) violations.push('White Line');
            if (p.refueling) violations.push('Refueling');
            if (p.driverChange) violations.push('Driver Change');
            if (p.excessMechanics) violations.push('Excess Mechanics');
            if (violations.length > 0) drawField('Violations', violations.join(', '));

            if (p.remarks) {
                doc.moveDown(0.5);
                doc.font(fontBold).text('Remarks:');
                drawText(p.remarks);
            }
        }

        if (ticket.controlReport) {
            const c = ticket.controlReport;
            drawSection('Control Report');
            if (c.competitorNumber) drawField('Competitor #', c.competitorNumber);
            if (c.lapNumber !== null) drawField('Lap', c.lapNumber);
            if (c.sector !== null) drawField('Sector', c.sector);
            if (c.violationType) drawField('Violation', c.violationType);
            if (c.actionTaken) drawField('Action Taken', c.actionTaken);
            if (c.penaltyValue) drawField('Penalty', c.penaltyValue);

            if (c.reasoning) {
                doc.moveDown(0.5);
                doc.font(fontBold).text('Reasoning:');
                drawText(c.reasoning);
            }
        }

        if (ticket.safetyReport) {
            const s = ticket.safetyReport;
            drawSection('Safety Report');
            if (s.hazardType) drawField('Hazard Type', s.hazardType);
            if (s.locationDetail) drawField('Location Detail', s.locationDetail);
            drawField('Intervention', s.interventionRequired);
            if (s.resourcesDeployed) drawField('Resources', s.resourcesDeployed);
            if (s.trackStatus) drawField('Track Status', s.trackStatus);

            if (s.damageDescription) {
                doc.moveDown(0.5);
                doc.font(fontBold).text('Damage:');
                drawText(s.damageDescription);
            }
        }

        if (ticket.activityLogs && ticket.activityLogs.length > 0) {
            drawSection('Activity Timeline');
            ticket.activityLogs.forEach(log => {
                const date = formatDate(log.createdAt, true);
                const action = safe(log.action).replace(/_/g, ' ');
                const actor = safe(log.actor?.name) || 'System';

                doc.fontSize(9).font(fontRegular).fill('#333')
                    .text(`${date}  |  ${action}  |  ${actor}`);
            });
        }

        // ── Footer ───────────────────────────────────────────────────────────

        // Add page numbers
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).fill('#9e9e9e');
            doc.text(`Generated: ${new Date().toISOString()}`, 50, 780, { align: 'left', width: 250 });
            doc.text('SAMF Incident Management System', 300, 780, { align: 'right', width: 245 });
            doc.text(`Page ${i + 1} of ${range.count}`, 300, 792, { align: 'right', width: 245 });
        }

        doc.end();

    } catch (error) {
        console.error('[PDFKit Export Error]:', error);
        if (!res.headersSent) res.status(500).json({ message: 'Export failed: ' + error.message });
    }
};

// ── Excel Export ─────────────────────────────────────────────────────────────

const exportExcel = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const where = {};
        if (startDate && endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            where.createdAt = { gte: new Date(startDate), lte: end };
        }

        const tickets = await prisma.ticket.findMany({
            where,
            include: { createdBy: true, medicalReport: true, pitGridReport: true },
            orderBy: { createdAt: 'desc' },
        });

        if (!tickets || tickets.length === 0) {
            return res.status(404).json({ message: 'No tickets found for the selected range.' });
        }

        const data = tickets.map(t => ({
            'Ticket No': safe(t.ticketNo),
            'Event': safe(t.eventName),
            'Open Date': t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '',
            'Closed Date': t.closedAt ? new Date(t.closedAt).toLocaleDateString() : '-',
            'Type': safe(t.type),
            'Status': safe(t.status),
            'Priority': safe(t.priority),
            'Reporter': safe(t.createdBy?.name) || 'Unknown',
            'Description': safe(t.description),
            'Patient Name': t.medicalReport ? (safe(t.medicalReport.patientGivenName) + ' ' + safe(t.medicalReport.patientSurname)).trim() : '',
            'Injury Type': safe(t.medicalReport?.injuryType),
            'License Action': safe(t.medicalReport?.licenseAction),
            'Car No': safe(t.pitGridReport?.carNumber) || safe(t.medicalReport?.carNumber),
        }));

        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(data), 'Tickets');
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="tickets_export_' + Date.now() + '.xlsx"');
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);
    } catch (error) {
        console.error('[Excel Export Error]:', error);
        res.status(500).json({ message: 'Excel export failed: ' + error.message });
    }
};

// ── Verify Report ────────────────────────────────────────────────────────────

const verifyReport = async (req, res) => {
    try {
        const record = await prisma.ticketExport.findUnique({
            where: { verifyToken: req.params.token },
            include: { ticket: { include: { createdBy: { select: { name: true } } } } },
        });
        if (!record) return res.status(404).json({ valid: false, message: 'Invalid or expired token' });
        res.json({
            valid: true,
            ticketNo: record.ticket.ticketNo,
            type: record.ticket.type,
            status: record.ticket.status,
            createdAt: record.ticket.createdAt,
            reporter: record.ticket.createdBy?.name,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { exportPdf, exportExcel, verifyReport };
