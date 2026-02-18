const prisma = require('../prismaClient');
const PDFDocument = require('pdfkit');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const QRCode = require('qrcode');

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

const clean = (text) => text;

// ── Shared PDF Generator ─────────────────────────────────────────────────────

const generatePdf = async (ticket, res, verifyToken, reqHost) => {
    const fileName = `report-${clean(safe(ticket.ticketNo))}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);

    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });

    // Pipe to response
    doc.pipe(res);

    // Capture buffer if needed (only for exportPdf, but we can skip logic or handle it if needed)
    // For now we stream directly.

    // ── Styles ───────────────────────────────────────────────────────────
    const fontBold = 'Helvetica-Bold';
    const fontRegular = 'Helvetica';

    // ── Layout Helpers ───────────────────────────────────────────────────

    const drawSection = (title) => {
        // Check space before starting section
        if (doc.y > 680) doc.addPage();
        else doc.moveDown(1.5);

        // Gray background bar
        doc.save();
        doc.fillColor('#f5f5f5').rect(50, doc.y, 495, 25).fill();
        doc.restore();

        doc.fontSize(12).font(fontBold).fill('#2e7d32').text(title.toUpperCase(), 60, doc.y + 7);
        doc.moveDown(0.8);
        doc.fill('#1a1a1a');
    };

    const drawField = (label, value) => {
        if (!value && value !== 0) return;

        // Ensure we don't break page in middle of field
        if (doc.y > 750) doc.addPage();

        const startY = doc.y;
        // Label
        doc.fontSize(10).font(fontBold).fill('#555555')
            .text(label + ':', 50, startY, { width: 140 });

        const labelHeight = doc.y - startY;

        // Value
        doc.font(fontRegular).fill('#1a1a1a')
            .text(String(value), 200, startY, { width: 345, align: 'left' });

        const valueHeight = doc.y - startY;

        // Advance
        const rowHeight = Math.max(labelHeight, valueHeight);
        doc.y = startY + rowHeight + 8;
    };

    const drawText = (text) => {
        if (!text) return;
        doc.fontSize(10).font(fontRegular).fill('#1a1a1a')
            .text(String(text), { width: 495, align: 'justify' });
        doc.moveDown(0.5);
    };

    // ── Header ───────────────────────────────────────────────────────────

    doc.rect(0, 0, 595, 100).fill('#2e7d32');

    doc.fontSize(24).font(fontBold).fill('white').text('INCIDENT REPORT', 50, 35);
    doc.fontSize(12).font(fontRegular).fill('#e8f5e9').text(`Ticket #${safe(ticket.ticketNo)}`, 50, 65);

    const status = safe(ticket.status).toUpperCase().replace(/_/g, ' ');
    doc.fontSize(12).font(fontBold).fill('white').text(status, 400, 35, { width: 145, align: 'right' });

    doc.fontSize(9).font(fontRegular).fill('#e8f5e9')
        .text(`Generated: ${new Date().toLocaleDateString()}`, 400, 65, { width: 145, align: 'right' });

    doc.y = 130;
    doc.fill('#1a1a1a');

    // ── Body ─────────────────────────────────────────────────────────────

    // Basic Info
    doc.save();
    doc.fillColor('#f5f5f5').rect(50, doc.y, 495, 25).fill();
    doc.restore();
    doc.fontSize(12).font(fontBold).fill('#2e7d32').text('BASIC INFORMATION', 60, doc.y + 7);
    doc.moveDown(1.5);

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
    else doc.fontSize(10).fill('#999').text('No description provided.', { align: 'center' });

    // Sub-reports
    if (ticket.medicalReport) {
        const m = ticket.medicalReport;
        drawSection('Medical Report');
        drawField('Patient', `${safe(m.patientGivenName)} ${safe(m.patientSurname)}`);
        drawField('DOB', m.patientDob ? formatDate(m.patientDob) : 'N/A');
        drawField('Gender', m.patientGender);
        drawField('Role', m.patientRole);
        if (m.carNumber) drawField('Car Number', m.carNumber);
        drawField('Injury Type', m.injuryType);
        if (m.treatmentGiven) drawField('Treatment', m.treatmentGiven);

        if (m.summary) {
            doc.moveDown(0.5);
            doc.font(fontBold).text('Summary:');
            drawText(m.summary);
        }
    }

    if (ticket.pitGridReport) {
        const p = ticket.pitGridReport;
        drawSection('Pit & Grid Report');
        if (p.teamName) drawField('Team', p.teamName);
        if (p.carNumber) drawField('Car Number', p.carNumber);
        if (p.driverName) drawField('Driver', p.driverName);

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
        if (c.violationType) drawField('Violation', c.violationType);
        if (c.actionTaken) drawField('Action Taken', c.actionTaken);
        if (c.reasoning) {
            doc.moveDown(0.5);
            doc.font(fontBold).text('Reasoning:');
            drawText(c.reasoning);
        }
    }

    if (ticket.safetyReport) {
        const s = ticket.safetyReport;
        drawSection('Safety Report');
        if (s.hazardType) drawField('Hazard', s.hazardType);
        if (s.locationDetail) drawField('Location Detail', s.locationDetail);
        drawField('Intervention', s.interventionRequired);
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
            doc.moveDown(0.4);
        });
    }

    // ── Images ───────────────────────────────────────────────────────────────

    // Filter for valid image attachments first
    const imageAttachments = (ticket.attachments || []).filter(att =>
        att.mimeType && att.mimeType.startsWith('image/')
    );

    if (imageAttachments.length > 0) {
        // Only add page if we have images
        doc.addPage();
        drawSection('Attachments');

        for (const att of imageAttachments) {
            try {
                let imgBuffer = null;
                console.log(`Processing attachment: ${att.url} (${att.mimeType})`);

                if (att.url.startsWith('http')) {
                    console.log('Fetching via HTTP...');
                    const resp = await axios.get(att.url, { responseType: 'arraybuffer' });
                    imgBuffer = Buffer.from(resp.data, 'binary');
                } else {
                    const relativePath = att.url.startsWith('/') ? att.url.substring(1) : att.url;

                    // 1. Try relative to backend (safe default for Node)
                    const localPath = path.join(__dirname, '..', relativePath);
                    console.log(`Resolved local path: ${localPath}`);

                    if (fs.existsSync(localPath)) {
                        console.log('File found locally.');
                        imgBuffer = fs.readFileSync(localPath);
                    } else {
                        // 2. Try relative to CWD (Root, if running from root)
                        const rootPath = path.join(process.cwd(), relativePath);
                        console.log(`Trying root path: ${rootPath}`);

                        if (fs.existsSync(rootPath)) {
                            console.log('File found at root path.');
                            imgBuffer = fs.readFileSync(rootPath);
                        } else {
                            // 3. Fallback: Try fetching via HTTP from localhost/reqHost
                            // This handles cases where file is served statically but not found on expected disk path provided
                            console.log('File NOT found on disk. Trying HTTP fallback...');
                            const host = reqHost || 'localhost:5000';
                            const protocol = host.includes('localhost') ? 'http' : 'https';
                            const fileUrl = `${protocol}://${host}/${relativePath}`;
                            console.log(`Fetching fallback URL: ${fileUrl}`);

                            try {
                                const resp = await axios.get(fileUrl, { responseType: 'arraybuffer' });
                                imgBuffer = Buffer.from(resp.data, 'binary');
                                console.log('HTTP fallback success.');
                            } catch (httpErr) {
                                console.error(`HTTP fallback failed: ${httpErr.message}`);
                            }
                        }
                    }
                }

                if (imgBuffer) {
                    // Check if image fits on current page (approx 350 height needed: 300 image + 50 text/margin)
                    if (doc.y > 500) doc.addPage();

                    doc.image(imgBuffer, { fit: [400, 300], align: 'center' });
                    doc.moveDown(0.5);
                    doc.fontSize(9).text(att.name || 'Image', { align: 'center' });
                    doc.moveDown(1.5);
                } else {
                    doc.fontSize(10).fill('red').text(`[Image not found: ${att.name}]`);
                    doc.moveDown();
                }
            } catch (err) {
                console.error(`Error loading image ${att.url}:`, err.message);
                doc.fontSize(10).fill('red').text(`[Error loading image: ${att.name}]`);
                doc.moveDown();
            }
        }
    }

    // ── QR Code & disclaimer (Last Page) ─────────────────────────────────────

    // Ensure space for QR
    if (doc.y > 600) doc.addPage();

    doc.moveDown(2);

    // QR Code links to Backend Verify URL (Direct PDF Access)
    // Construct link relative to request host if possible, or fallback
    const host = reqHost || process.env.BACKEND_URL || 'incident-backend.onrender.com';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const verifyLink = `${protocol}://${host}/api/verify/${verifyToken}`;

    try {
        const qrDataUrl = await QRCode.toDataURL(verifyLink);
        doc.image(qrDataUrl, { fit: [100, 100], align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(8).fill('#666666').text('Scan to View Verified Online Report', { align: 'center' });
        doc.moveDown(0.2);
        doc.text('This document is digitally verified online.', { align: 'center' });
        doc.text('No physical signature or stamp required.', { align: 'center' });
    } catch (qrErr) {
        console.error('QR Gen Error:', qrErr);
    }

    // ── Footer ───────────────────────────────────────────────────────────────

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fill('#9e9e9e');
        doc.text(`Generated: ${new Date().toISOString()}`, 50, 780, { align: 'left', width: 250 });
        doc.text('SAMF Incident Management System', 300, 780, { align: 'right', width: 245 });
        doc.text(`Page ${i + 1} of ${range.start + range.count}`, 300, 792, { align: 'right', width: 245 });
    }

    doc.end();
};

// ── Export Functions ─────────────────────────────────────────────────────────

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
                attachments: true,
                activityLogs: {
                    include: { actor: { select: { name: true } } },
                    orderBy: { createdAt: 'desc' },
                    take: 20
                }
            }
        });

        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const verifyToken = Math.random().toString(36).substring(2, 10).toUpperCase();

        // Save export record
        await prisma.ticketExport.create({
            data: {
                ticketId: req.params.id,
                verifyToken: verifyToken,
                pdfUrl: 'STREAMED',
                snapshotJson: JSON.stringify({ id: ticket.id, ticketNo: ticket.ticketNo })
            }
        });

        const reqHost = req.get('host');
        await generatePdf(ticket, res, verifyToken, reqHost);

    } catch (error) {
        console.error('[PDF Export Error]:', error);
        if (!res.headersSent) res.status(500).json({ message: 'Export failed: ' + error.message });
    }
};

const verifyReport = async (req, res) => {
    // Debug hooks
    if (req.params.token === 'version') {
        return res.json({ version: 'pdfkit-v3-pro', timestamp: new Date().toISOString() });
    }

    try {
        const record = await prisma.ticketExport.findUnique({
            where: { verifyToken: req.params.token },
            include: {
                ticket: {
                    include: {
                        createdBy: { select: { name: true, email: true } },
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
                }
            },
        });

        if (!record) return res.status(404).json({ message: 'Invalid or expired token' });

        // Regenerate and stream the PDF for the viewer
        const reqHost = req.get('host');
        await generatePdf(record.ticket, res, record.verifyToken, reqHost);

    } catch (error) {
        console.error('[Verify Report Error]:', error);
        res.status(500).json({ message: error.message });
    }
};

const exportExcel = async (req, res) => {
    // ... existing excel logic remains same, but we need to include it in overwrite ...
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
            'Type': safe(t.type),
            'Status': safe(t.status),
            'Priority': safe(t.priority),
            'Reporter': safe(t.createdBy?.name) || 'Unknown',
            'Description': safe(t.description),
        }));

        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(data), 'Tickets');
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="tickets_export_' + Date.now() + '.xlsx"');
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ message: 'Excel export failed: ' + error.message });
    }
};

module.exports = { exportPdf, exportExcel, verifyReport };
