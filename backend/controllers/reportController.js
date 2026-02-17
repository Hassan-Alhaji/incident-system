const prisma = require('../prismaClient');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
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

// pdf-lib standard fonts only support WinAnsi (Latin-1).
// Strip unsupported characters to prevent NaN width calculation errors.
const clean = (text) => {
    if (!text) return '';
    return String(text)
        .replace(/[\u00A0]/g, ' ')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/[\u2026]/g, '...')
        .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '')
        .replace(/[^\x20-\xFF]/g, '?');
};

// ── PDF Export ───────────────────────────────────────────────────────────────

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
                    take: 15,
                },
            },
        });

        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        // ── Create PDF ───────────────────────────────────────────────────────
        const pdf = await PDFDocument.create();
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

        const W = 595.28;   // A4 width
        const H = 841.89;   // A4 height
        const M = 50;       // margin
        const CW = W - 2 * M; // content width

        let page = pdf.addPage([W, H]);
        let y = H - M;

        // ── Drawing helpers ──────────────────────────────────────────────────
        const newPageIfNeeded = (need = 30) => {
            if (y < M + need) {
                page = pdf.addPage([W, H]);
                y = H - M;
            }
        };

        const title = (text, size = 18) => {
            newPageIfNeeded(size + 10);
            page.drawText(clean(safe(text)), { x: M, y, size, font: bold, color: rgb(0.1, 0.4, 0.25) });
            y -= size + 4;
            // underline
            page.drawLine({ start: { x: M, y: y + 2 }, end: { x: W - M, y: y + 2 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
            y -= 8;
        };

        const label = (lbl, val, size = 10) => {
            newPageIfNeeded(size + 6);
            const t = clean(`${safe(lbl)}: ${safe(val)}`);
            page.drawText(t, { x: M + 10, y, size, font, color: rgb(0.15, 0.15, 0.15) });
            y -= size + 5;
        };

        const boldLabel = (lbl, val, size = 10) => {
            newPageIfNeeded(size + 6);
            const lblText = clean(safe(lbl) + ': ');
            const valText = clean(safe(val));
            const lblWidth = bold.widthOfTextAtSize(lblText, size);
            page.drawText(lblText, { x: M + 10, y, size, font: bold, color: rgb(0.15, 0.15, 0.15) });
            page.drawText(valText, { x: M + 10 + lblWidth, y, size, font, color: rgb(0.25, 0.25, 0.25) });
            y -= size + 5;
        };

        const spacer = (amount = 12) => { y -= amount; };

        const paragraph = (text, size = 10) => {
            const words = clean(safe(text)).split(' ');
            let line = '';
            for (const word of words) {
                const test = line ? line + ' ' + word : word;
                const w = font.widthOfTextAtSize(test, size);
                if (w > CW - 20) {
                    newPageIfNeeded(size + 4);
                    page.drawText(line, { x: M + 10, y, size, font, color: rgb(0.2, 0.2, 0.2) });
                    y -= size + 4;
                    line = word;
                } else {
                    line = test;
                }
            }
            if (line) {
                newPageIfNeeded(size + 4);
                page.drawText(line, { x: M + 10, y, size, font, color: rgb(0.2, 0.2, 0.2) });
                y -= size + 4;
            }
        };

        // ── Header ───────────────────────────────────────────────────────────
        page.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: rgb(0.1, 0.4, 0.25) });
        page.drawText('INCIDENT REPORT', { x: M, y: H - 45, size: 22, font: bold, color: rgb(1, 1, 1) });
        page.drawText(clean(`Ticket #${safe(ticket.ticketNo)}`), { x: M, y: H - 62, size: 11, font, color: rgb(0.85, 0.95, 0.88) });

        // Status badge
        const statusText = clean(safe(ticket.status).replace(/_/g, ' '));
        const statusW = bold.widthOfTextAtSize(statusText, 10) + 16;
        const badgeX = W - M - statusW;
        page.drawRectangle({ x: badgeX, y: H - 56, width: statusW, height: 20, color: rgb(1, 1, 1) });
        page.drawText(statusText, { x: badgeX + 8, y: H - 50, size: 10, font: bold, color: rgb(0.1, 0.4, 0.25) });

        y = H - 95;

        // ── Basic Information ────────────────────────────────────────────────
        title('Basic Information');
        boldLabel('Event', ticket.eventName);
        boldLabel('Type', ticket.type);
        boldLabel('Priority', ticket.priority);
        boldLabel('Location', ticket.location || 'N/A');
        boldLabel('Date', ticket.incidentDate ? formatDate(ticket.incidentDate) : formatDate(ticket.createdAt));
        boldLabel('Time', ticket.incidentTime || 'N/A');
        boldLabel('Reporter', ticket.createdBy?.name || ticket.reporterName || 'N/A');
        if (ticket.postNumber) boldLabel('Post Number', ticket.postNumber);
        if (ticket.marshalId) boldLabel('Marshal ID', ticket.marshalId);
        spacer();

        // ── Description ─────────────────────────────────────────────────────
        title('Description');
        if (ticket.description) {
            paragraph(ticket.description);
        } else {
            label('', 'No description provided.');
        }
        spacer();

        // ── Medical Report ───────────────────────────────────────────────────
        if (ticket.medicalReport) {
            const m = ticket.medicalReport;
            title('Medical Report');
            boldLabel('Patient', `${safe(m.patientGivenName)} ${safe(m.patientSurname)}`);
            boldLabel('Date of Birth', m.patientDob ? formatDate(m.patientDob) : 'N/A');
            boldLabel('Gender', m.patientGender);
            boldLabel('Role', m.patientRole);
            if (m.motorsportId) boldLabel('Motorsport ID', m.motorsportId);
            if (m.carNumber) boldLabel('Car Number', m.carNumber);
            if (m.permitNumber) boldLabel('Permit Number', m.permitNumber);
            boldLabel('Injury Type', m.injuryType);
            boldLabel('License Action', m.licenseAction);
            if (m.treatmentLocation) boldLabel('Treatment Location', m.treatmentLocation);
            if (m.arrivalMethod) boldLabel('Arrival Method', m.arrivalMethod);
            if (m.initialCondition) boldLabel('Initial Condition', m.initialCondition);
            if (m.treatmentGiven) boldLabel('Treatment Given', m.treatmentGiven);
            if (m.summary) { spacer(4); paragraph(`Summary: ${m.summary}`); }
            if (m.recommendation) { spacer(4); paragraph(`Recommendation: ${m.recommendation}`); }
            spacer();
        }

        // ── Control Report ───────────────────────────────────────────────────
        if (ticket.controlReport) {
            const c = ticket.controlReport;
            title('Control Report');
            if (c.competitorNumber) boldLabel('Competitor Number', c.competitorNumber);
            if (c.lapNumber !== null && c.lapNumber !== undefined) boldLabel('Lap Number', c.lapNumber);
            if (c.sector !== null && c.sector !== undefined) boldLabel('Sector', c.sector);
            if (c.violationType) boldLabel('Violation Type', c.violationType);
            if (c.competitors) boldLabel('Competitors', c.competitors);
            if (c.actionTaken) boldLabel('Action Taken', c.actionTaken);
            if (c.penaltyValue) boldLabel('Penalty', c.penaltyValue);
            if (c.reasoning) { spacer(4); paragraph(`Reasoning: ${c.reasoning}`); }
            spacer();
        }

        // ── Pit & Grid Report ────────────────────────────────────────────────
        if (ticket.pitGridReport) {
            const p = ticket.pitGridReport;
            title('Pit & Grid Report');
            if (p.sessionCategory) boldLabel('Session', p.sessionCategory);
            if (p.teamName) boldLabel('Team', p.teamName);
            if (p.carNumber) boldLabel('Car Number', p.carNumber);
            if (p.driverName) boldLabel('Driver', p.driverName);
            if (p.pitNumber) boldLabel('Pit Number', p.pitNumber);
            if (p.lapNumber !== null && p.lapNumber !== undefined) boldLabel('Lap Number', p.lapNumber);
            if (p.speedLimit) boldLabel('Speed Limit', p.speedLimit);
            if (p.speedRecorded) boldLabel('Speed Recorded', p.speedRecorded);
            if (p.radarOperatorName) boldLabel('Radar Operator', p.radarOperatorName);

            const violations = [];
            if (p.drivingOnWhiteLine) violations.push('Driving on White Line');
            if (p.refueling) violations.push('Refueling');
            if (p.driverChange) violations.push('Driver Change');
            if (p.excessMechanics) violations.push('Excess Mechanics');
            if (violations.length > 0) boldLabel('Violations', violations.join(', '));
            if (p.remarks) { spacer(4); paragraph(`Remarks: ${p.remarks}`); }
            spacer();
        }

        // ── Safety Report ────────────────────────────────────────────────────
        if (ticket.safetyReport) {
            const s = ticket.safetyReport;
            title('Safety Report');
            if (s.hazardType) boldLabel('Hazard Type', s.hazardType);
            if (s.locationDetail) boldLabel('Location Detail', s.locationDetail);
            boldLabel('Intervention Required', s.interventionRequired);
            if (s.resourcesDeployed) boldLabel('Resources Deployed', s.resourcesDeployed);
            if (s.trackStatus) boldLabel('Track Status', s.trackStatus);
            if (s.damageDescription) { spacer(4); paragraph(`Damage: ${s.damageDescription}`); }
            spacer();
        }

        // ── Activity Timeline ────────────────────────────────────────────────
        if (ticket.activityLogs && ticket.activityLogs.length > 0) {
            title('Activity Timeline');
            for (const log of ticket.activityLogs) {
                const date = formatDate(log.createdAt, true);
                const action = safe(log.action).replace(/_/g, ' ');
                const actor = safe(log.actor?.name) || 'System';
                label('', `${date}  |  ${action}  |  ${actor}`, 9);
            }
            spacer();
        }

        // ── Footer on last page ──────────────────────────────────────────────
        const verifyToken = Math.random().toString(36).substring(2, 10).toUpperCase();
        newPageIfNeeded(40);
        page.drawLine({ start: { x: M, y: 60 }, end: { x: W - M, y: 60 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
        page.drawText(clean(`Token: ${verifyToken}  |  Generated: ${new Date().toISOString()}`), {
            x: M, y: 45, size: 7, font, color: rgb(0.5, 0.5, 0.5),
        });
        page.drawText('SAMF Incident Management System', {
            x: M, y: 35, size: 7, font, color: rgb(0.5, 0.5, 0.5),
        });

        // ── Send Response ────────────────────────────────────────────────────
        const pdfBytes = await pdf.save();
        const fileName = `report-${safe(ticket.ticketNo)}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', pdfBytes.length);
        res.send(Buffer.from(pdfBytes));

        // Log export
        try {
            await prisma.ticketExport.create({
                data: { ticketId: req.params.id, verifyToken, pdfUrl: 'BUFFERED', snapshotJson: JSON.stringify({ id: ticket.id, ticketNo: ticket.ticketNo }) },
            });
        } catch (e) { console.error('Export log error:', e); }

    } catch (error) {
        console.error('[PDF Export Error]:', error.message, error.stack);
        if (!res.headersSent) res.status(500).json({ message: `Export failed: ${error.message}` });
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
            'Patient Name': t.medicalReport ? `${safe(t.medicalReport.patientGivenName)} ${safe(t.medicalReport.patientSurname)}`.trim() : '',
            'Injury Type': safe(t.medicalReport?.injuryType),
            'License Action': safe(t.medicalReport?.licenseAction),
            'Car No': safe(t.pitGridReport?.carNumber) || safe(t.medicalReport?.carNumber),
        }));

        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(data), 'Tickets');
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="tickets_export_${Date.now()}.xlsx"`);
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);
    } catch (error) {
        console.error('[Excel Export Error]:', error);
        res.status(500).json({ message: `Excel export failed: ${error.message}` });
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
