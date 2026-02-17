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

// Aggressively strip EVERYTHING except basic printable ASCII (32-126)
// This eliminates ALL possible sources of NaN from character width calculation
const clean = (text) => {
    if (!text) return '';
    return String(text).replace(/[^ -~]/g, '');
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

        const pdf = await PDFDocument.create();
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

        const W = 595;
        const H = 842;
        const M = 50;

        let page = pdf.addPage([W, H]);
        let y = H - M;

        const newPage = (need) => {
            if (y < M + (need || 30)) {
                page = pdf.addPage([W, H]);
                y = H - M;
            }
        };

        // Draw a single line of text — NO measurement, NO width calculation
        const drawLine = (text, size, useFont, color, indent) => {
            const sz = size || 10;
            const x = M + (indent || 0);
            newPage(sz + 6);
            try {
                page.drawText(clean(safe(text)), {
                    x: x,
                    y: y,
                    size: sz,
                    font: useFont || font,
                    color: color || rgb(0.15, 0.15, 0.15),
                });
            } catch (e) {
                console.error('[PDF] drawText error:', e.message);
            }
            y -= sz + 5;
        };

        const sectionTitle = (text) => {
            newPage(30);
            drawLine(text, 14, bold, rgb(0.1, 0.4, 0.25), 0);
            // underline
            page.drawLine({
                start: { x: M, y: y + 3 },
                end: { x: W - M, y: y + 3 },
                thickness: 1,
                color: rgb(0.85, 0.85, 0.85),
            });
            y -= 5;
        };

        const field = (label, value) => {
            // Combine label and value as ONE string — avoids widthOfTextAtSize entirely
            drawLine(clean(safe(label)) + ':  ' + clean(safe(value)), 10, font, rgb(0.2, 0.2, 0.2), 10);
        };

        const spacer = () => { y -= 10; };

        // Write long text by splitting into ~80 char lines
        const writeText = (text) => {
            const str = clean(safe(text));
            if (!str) return;
            const maxChars = 85;
            let i = 0;
            while (i < str.length) {
                let end = Math.min(i + maxChars, str.length);
                // Try to break at a space
                if (end < str.length) {
                    const lastSpace = str.lastIndexOf(' ', end);
                    if (lastSpace > i) end = lastSpace;
                }
                drawLine(str.substring(i, end).trim(), 10, font, rgb(0.2, 0.2, 0.2), 10);
                i = end;
                // Skip the space we broke at
                if (str[i] === ' ') i++;
            }
        };

        // ── Header ───────────────────────────────────────────────────────────
        page.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: rgb(0.1, 0.4, 0.25) });
        page.drawText('INCIDENT REPORT', { x: M, y: H - 45, size: 22, font: bold, color: rgb(1, 1, 1) });
        page.drawText(clean('Ticket #' + safe(ticket.ticketNo)), { x: M, y: H - 62, size: 11, font: font, color: rgb(0.85, 0.95, 0.88) });

        // Status badge (right side, simple text)
        const statusText = clean(safe(ticket.status).replace(/_/g, ' '));
        page.drawText(statusText, { x: W - M - 120, y: H - 50, size: 11, font: bold, color: rgb(1, 1, 1) });

        y = H - 95;

        // ── Basic Information ────────────────────────────────────────────────
        sectionTitle('BASIC INFORMATION');
        field('Event', ticket.eventName);
        field('Type', ticket.type);
        field('Priority', ticket.priority);
        field('Location', ticket.location || 'N/A');
        field('Date', ticket.incidentDate ? formatDate(ticket.incidentDate) : formatDate(ticket.createdAt));
        field('Time', ticket.incidentTime || 'N/A');
        field('Reporter', ticket.createdBy?.name || ticket.reporterName || 'N/A');
        if (ticket.postNumber) field('Post Number', ticket.postNumber);
        if (ticket.marshalId) field('Marshal ID', ticket.marshalId);
        spacer();

        // ── Description ─────────────────────────────────────────────────────
        sectionTitle('DESCRIPTION');
        if (ticket.description) {
            writeText(ticket.description);
        } else {
            drawLine('No description provided.', 10, font, rgb(0.5, 0.5, 0.5), 10);
        }
        spacer();

        // ── Medical Report ───────────────────────────────────────────────────
        if (ticket.medicalReport) {
            const m = ticket.medicalReport;
            sectionTitle('MEDICAL REPORT');
            field('Patient', safe(m.patientGivenName) + ' ' + safe(m.patientSurname));
            field('Date of Birth', m.patientDob ? formatDate(m.patientDob) : 'N/A');
            field('Gender', m.patientGender);
            field('Role', m.patientRole);
            if (m.motorsportId) field('Motorsport ID', m.motorsportId);
            if (m.carNumber) field('Car Number', m.carNumber);
            if (m.permitNumber) field('Permit Number', m.permitNumber);
            field('Injury Type', m.injuryType);
            field('License Action', m.licenseAction);
            if (m.treatmentLocation) field('Treatment Location', m.treatmentLocation);
            if (m.arrivalMethod) field('Arrival Method', m.arrivalMethod);
            if (m.initialCondition) field('Initial Condition', m.initialCondition);
            if (m.treatmentGiven) field('Treatment Given', m.treatmentGiven);
            if (m.summary) { spacer(); writeText('Summary: ' + safe(m.summary)); }
            if (m.recommendation) { spacer(); writeText('Recommendation: ' + safe(m.recommendation)); }
            spacer();
        }

        // ── Control Report ───────────────────────────────────────────────────
        if (ticket.controlReport) {
            const c = ticket.controlReport;
            sectionTitle('CONTROL REPORT');
            if (c.competitorNumber) field('Competitor Number', c.competitorNumber);
            if (c.lapNumber !== null && c.lapNumber !== undefined) field('Lap Number', c.lapNumber);
            if (c.sector !== null && c.sector !== undefined) field('Sector', c.sector);
            if (c.violationType) field('Violation Type', c.violationType);
            if (c.competitors) field('Competitors', c.competitors);
            if (c.actionTaken) field('Action Taken', c.actionTaken);
            if (c.penaltyValue) field('Penalty', c.penaltyValue);
            if (c.reasoning) { spacer(); writeText('Reasoning: ' + safe(c.reasoning)); }
            spacer();
        }

        // ── Pit & Grid Report ────────────────────────────────────────────────
        if (ticket.pitGridReport) {
            const p = ticket.pitGridReport;
            sectionTitle('PIT & GRID REPORT');
            if (p.sessionCategory) field('Session', p.sessionCategory);
            if (p.teamName) field('Team', p.teamName);
            if (p.carNumber) field('Car Number', p.carNumber);
            if (p.driverName) field('Driver', p.driverName);
            if (p.pitNumber) field('Pit Number', p.pitNumber);
            if (p.lapNumber !== null && p.lapNumber !== undefined) field('Lap Number', p.lapNumber);
            if (p.speedLimit) field('Speed Limit', p.speedLimit);
            if (p.speedRecorded) field('Speed Recorded', p.speedRecorded);
            if (p.radarOperatorName) field('Radar Operator', p.radarOperatorName);

            const violations = [];
            if (p.drivingOnWhiteLine) violations.push('Driving on White Line');
            if (p.refueling) violations.push('Refueling');
            if (p.driverChange) violations.push('Driver Change');
            if (p.excessMechanics) violations.push('Excess Mechanics');
            if (violations.length > 0) field('Violations', violations.join(', '));
            if (p.remarks) { spacer(); writeText('Remarks: ' + safe(p.remarks)); }
            spacer();
        }

        // ── Safety Report ────────────────────────────────────────────────────
        if (ticket.safetyReport) {
            const s = ticket.safetyReport;
            sectionTitle('SAFETY REPORT');
            if (s.hazardType) field('Hazard Type', s.hazardType);
            if (s.locationDetail) field('Location Detail', s.locationDetail);
            field('Intervention Required', s.interventionRequired);
            if (s.resourcesDeployed) field('Resources Deployed', s.resourcesDeployed);
            if (s.trackStatus) field('Track Status', s.trackStatus);
            if (s.damageDescription) { spacer(); writeText('Damage: ' + safe(s.damageDescription)); }
            spacer();
        }

        // ── Activity Timeline ────────────────────────────────────────────────
        if (ticket.activityLogs && ticket.activityLogs.length > 0) {
            sectionTitle('ACTIVITY TIMELINE');
            for (const log of ticket.activityLogs) {
                const date = formatDate(log.createdAt, true);
                const action = safe(log.action).replace(/_/g, ' ');
                const actor = safe(log.actor?.name) || 'System';
                drawLine(date + '  |  ' + action + '  |  ' + actor, 9, font, rgb(0.35, 0.35, 0.35), 10);
            }
            spacer();
        }

        // ── Footer ───────────────────────────────────────────────────────────
        const verifyToken = Math.random().toString(36).substring(2, 10).toUpperCase();
        newPage(40);
        page.drawLine({
            start: { x: M, y: 60 },
            end: { x: W - M, y: 60 },
            thickness: 0.5,
            color: rgb(0.8, 0.8, 0.8),
        });
        page.drawText(clean('Token: ' + verifyToken + '  |  Generated: ' + new Date().toISOString()), {
            x: M, y: 45, size: 7, font: font, color: rgb(0.5, 0.5, 0.5),
        });
        page.drawText('SAMF Incident Management System', {
            x: M, y: 35, size: 7, font: font, color: rgb(0.5, 0.5, 0.5),
        });

        // ── Send ─────────────────────────────────────────────────────────────
        const pdfBytes = await pdf.save();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="report-' + clean(safe(ticket.ticketNo)) + '.pdf"');
        res.setHeader('Content-Length', pdfBytes.length);
        res.send(Buffer.from(pdfBytes));

        try {
            await prisma.ticketExport.create({
                data: { ticketId: req.params.id, verifyToken: verifyToken, pdfUrl: 'BUFFERED', snapshotJson: JSON.stringify({ id: ticket.id, ticketNo: ticket.ticketNo }) },
            });
        } catch (e) { console.error('Export log error:', e); }

    } catch (error) {
        console.error('[PDF Export Error]:', error.message, error.stack);
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
