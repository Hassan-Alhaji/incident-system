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
    doc.pipe(res);

    // ── Styles ───────────────────────────────────────────────────────────
    const fontBold = 'Helvetica-Bold';
    const fontRegular = 'Helvetica';
    const colorPrimary = '#1e3a8a'; // Deep blue
    const colorSecondary = '#e2e8f0'; // Light slate background
    const colorTextPrimary = '#0f172a'; // Dark slate
    const colorTextSecondary = '#64748b'; // Muted slate

    // ── Layout Helpers ───────────────────────────────────────────────────

    const checkSpace = (neededSpace) => {
        if (doc.y + neededSpace > 750) {
            doc.addPage();
            return true;
        }
        return false;
    };

    const drawSection = (title) => {
        checkSpace(60); // Require at least 60 points for a section header + first field
        if (doc.y > 100) doc.moveDown(1.5);

        const startY = doc.y;
        doc.save();
        doc.fillColor(colorSecondary).rect(50, startY, 495, 24).fill();
        doc.restore();

        doc.fontSize(11).font(fontBold).fill(colorPrimary).text(title.toUpperCase(), 60, startY + 7);
        doc.y = startY + 34;
        doc.fill(colorTextPrimary);
    };

    const drawField = (label, value) => {
        if (value === null || value === undefined || value === '') return;

        checkSpace(30);

        const startY = doc.y;
        doc.fontSize(10).font(fontBold).fill(colorTextSecondary)
            .text(label, 50, startY, { width: 140 });

        const labelHeight = doc.y - startY;

        doc.font(fontRegular).fill(colorTextPrimary)
            .text(String(value), 190, startY, { width: 355, align: 'left' });

        const valueHeight = doc.y - startY;
        doc.y = startY + Math.max(labelHeight, valueHeight) + 8;
    };

    const drawText = (text) => {
        if (!text) return;
        checkSpace(30);
        doc.fontSize(10).font(fontRegular).fill(colorTextPrimary)
            .text(String(text), 50, doc.y, { width: 495, align: 'justify' });
        doc.moveDown(0.8);
    };

    // ── Header ───────────────────────────────────────────────────────────

    doc.rect(0, 0, 595, 100).fill(colorPrimary);

    doc.fontSize(24).font(fontBold).fill('white').text('INCIDENT REPORT', 50, 35);
    doc.fontSize(12).font(fontRegular).fill('#bfdbfe').text(`Ticket #${safe(ticket.ticketNo)}`, 50, 65);

    const status = safe(ticket.status).toUpperCase().replace(/_/g, ' ');
    doc.fontSize(12).font(fontBold).fill('white').text(status, 400, 35, { width: 145, align: 'right' });

    doc.fontSize(9).font(fontRegular).fill('#bfdbfe')
        .text(`Generated: ${new Date().toLocaleDateString()}`, 400, 65, { width: 145, align: 'right' });

    doc.y = 120;
    doc.fill(colorTextPrimary);

    // ── Body ─────────────────────────────────────────────────────────────

    // Event Info
    drawSection('Incident Overview');
    drawField('Event', ticket.eventName);
    drawField('Type', ticket.type);
    drawField('Priority', ticket.priority);
    drawField('Location', ticket.location || 'N/A');
    drawField('Date', ticket.incidentDate ? formatDate(ticket.incidentDate) : formatDate(ticket.createdAt));
    drawField('Time', ticket.incidentTime || 'N/A');
    drawField('Reporter', ticket.createdBy?.name || ticket.reporterName || 'N/A');
    if (ticket.postNumber) drawField('Post Number', ticket.postNumber);
    if (ticket.marshalId) drawField('Marshal ID', ticket.marshalId);

    if (ticket.description) {
        drawSection('Description');
        drawText(ticket.description);
    }

    // Sub-reports
    if (ticket.medicalReport) {
        const m = ticket.medicalReport;
        drawSection('Medical Details');
        drawField('Patient', `${safe(m.patientGivenName)} ${safe(m.patientSurname)}`.trim());
        drawField('Date of Birth', m.patientDob ? formatDate(m.patientDob) : '');
        drawField('Gender', m.patientGender);
        drawField('Role', m.patientRole);
        drawField('Car Number', m.carNumber);
        drawField('Injury Type', m.injuryType);
        drawField('Treatment', m.treatmentGiven);
        drawField('Notes', m.summary);
    }

    if (ticket.pitGridReport) {
        const p = ticket.pitGridReport;
        drawSection('Pit & Grid Details');
        drawField('Team', p.teamName);
        drawField('Car Number', p.carNumber);
        drawField('Driver', p.driverName);

        const violations = [];
        if (p.drivingOnWhiteLine) violations.push('White Line');
        if (p.refueling) violations.push('Refueling');
        if (p.driverChange) violations.push('Driver Change');
        if (p.excessMechanics) violations.push('Excess Mechanics');
        if (violations.length > 0) drawField('Violations', violations.join(', '));
        drawField('Remarks', p.remarks);
    }

    if (ticket.controlReport) {
        const c = ticket.controlReport;
        drawSection('Control Details');
        drawField('Competitor #', c.competitorNumber);
        drawField('Violation', c.violationType);
        drawField('Action Taken', c.actionTaken);
        drawField('Reasoning', c.reasoning);
    }

    if (ticket.safetyReport) {
        const s = ticket.safetyReport;
        drawSection('Safety Details');
        drawField('Hazard', s.hazardType);
        drawField('Location Detail', s.locationDetail);
        drawField('Intervention Required', s.interventionRequired);
        drawField('Damage', s.damageDescription);
    }

    // Timeline - Keep it compact
    if (ticket.activityLogs && ticket.activityLogs.length > 0) {
        drawSection('Activity Timeline');
        ticket.activityLogs.forEach(log => {
            checkSpace(20);
            const date = formatDate(log.createdAt, true);
            const action = safe(log.action).replace(/_/g, ' ');
            const actor = safe(log.actor?.name) || 'System';
            doc.fontSize(9).font(fontRegular).fill(colorTextSecondary)
                .text(`${date}  |  ${action}  |  ${actor}`);
            doc.moveDown(0.4);
        });
    }

    // ── Images ───────────────────────────────────────────────────────────────

    const imageAttachments = (ticket.attachments || []).filter(att =>
        att.mimeType && att.mimeType.startsWith('image/')
    );

    if (imageAttachments.length > 0) {
        drawSection('Image Attachments');
        doc.moveDown(1);

        for (const att of imageAttachments) {
            try {
                let imgBuffer = null;

                if (att.data) {
                    imgBuffer = att.data;
                } else if (att.url.startsWith('http')) {
                    const resp = await axios.get(att.url, { responseType: 'arraybuffer' });
                    imgBuffer = Buffer.from(resp.data, 'binary');
                } else {
                    const relativePath = att.url.startsWith('/') ? att.url.substring(1) : att.url;
                    const backendPath = path.join(__dirname, '..', relativePath);
                    if (fs.existsSync(backendPath)) {
                        imgBuffer = fs.readFileSync(backendPath);
                    } else {
                        const rootPath = path.join(process.cwd(), relativePath);
                        if (fs.existsSync(rootPath)) {
                            imgBuffer = fs.readFileSync(rootPath);
                        } else {
                            const port = process.env.PORT || 3000;
                            const cleanRelPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
                            const localhostUrl = `http://127.0.0.1:${port}/${cleanRelPath}`;
                            try {
                                const resp = await axios.get(localhostUrl, { responseType: 'arraybuffer' });
                                imgBuffer = Buffer.from(resp.data, 'binary');
                            } catch (localErr) {
                                if (reqHost) {
                                    const protocol = reqHost.includes('localhost') ? 'http' : 'https';
                                    const publicUrl = `${protocol}://${reqHost}/${cleanRelPath}`;
                                    try {
                                        const resp = await axios.get(publicUrl, { responseType: 'arraybuffer' });
                                        imgBuffer = Buffer.from(resp.data, 'binary');
                                    } catch (publicErr) {
                                        console.error(`Public error fallback failed`);
                                    }
                                }
                            }
                        }
                    }
                }

                if (imgBuffer) {
                    // Check if image + label fits on current page (requires ~320 points)
                    checkSpace(320);

                    doc.image(imgBuffer, { fit: [450, 280], align: 'center' });
                    doc.moveDown(0.5);
                    doc.fontSize(9).fill(colorTextSecondary).text(att.name || 'Image Snapshot', { align: 'center' });
                    doc.moveDown(2);
                }
            } catch (err) {
                console.error(`[PDF] Error handling image ${att.url}:`, err.message);
            }
        }
    }

    // ── QR Code ──────────────────────────────────────────────────────────────

    // Allow QR code to flow naturally unless we are near the bottom
    checkSpace(150);
    doc.moveDown(2);

    const host = reqHost || process.env.BACKEND_URL || 'incident-system-yqtd.onrender.com';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const verifyLink = `${protocol}://${host}/api/verify/${verifyToken}`;

    try {
        const qrDataUrl = await QRCode.toDataURL(verifyLink);
        doc.image(qrDataUrl, { fit: [90, 90], align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(9).font(fontBold).fill(colorPrimary).text('Official Online Record', { align: 'center' });
        doc.fontSize(8).font(fontRegular).fill(colorTextSecondary).text('Scan QR code to access the verified digital report.', { align: 'center' });
    } catch (qrErr) {
        console.error('QR Gen Error:', qrErr);
    }

    // ── Footer ───────────────────────────────────────────────────────────────

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        // Top border for footer
        doc.moveTo(50, 770).lineTo(545, 770).lineWidth(0.5).strokeColor(colorSecondary).stroke();

        doc.fontSize(8).fill(colorTextSecondary);
        doc.text(`Generated: ${new Date().toISOString()}`, 50, 780, { align: 'left', width: 250 });
        doc.text(`Page ${i + 1} of ${range.start + range.count}`, 300, 780, { align: 'right', width: 245 });
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
