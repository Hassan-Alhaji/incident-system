const prisma = require('../prismaClient');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

// @desc    Export ticket report to PDF (MINIMAL VERSION for serverless)
// @route   POST /api/tickets/:id/export-pdf
// @access  Private
const exportPdf = async (req, res) => {
    const ticketId = req.params.id;

    try {
        console.log('[PDF] Starting export for ticket:', ticketId);

        // Fetch minimal data - NO ATTACHMENTS
        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            include: {
                createdBy: { select: { name: true, email: true, mobile: true } },
                medicalReport: true,
                activityLogs: {
                    include: { actor: { select: { name: true } } },
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            }
        });

        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        console.log('[PDF] Data fetched, creating document');

        const verifyToken = Math.random().toString(36).substring(2, 10).toUpperCase();

        // Create PDF with minimal options
        const chunks = [];
        const doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            autoFirstPage: true
        });

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            console.log('[PDF] Document finalized, sending response');
            const pdfBuffer = Buffer.concat(chunks);
            const fileName = `report-${ticket.ticketNo}.pdf`;

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.setHeader('Content-Length', pdfBuffer.length);
            res.send(pdfBuffer);
        });

        // Log export (fire & forget)
        prisma.ticketExport.create({
            data: {
                ticketId,
                verifyToken,
                pdfUrl: 'BUFFERED',
                snapshotJson: JSON.stringify({ id: ticket.id, ticketNo: ticket.ticketNo })
            }
        }).catch(e => console.error('Export log error:', e));

        console.log('[PDF] Starting content generation');

        // === SIMPLE HEADER ===
        doc.fontSize(18).fillColor('#047857').text('OFFICIAL INCIDENT REPORT', { align: 'center' });
        doc.fontSize(10).fillColor('#6b7280').text('Saudi Automobile & Motorcycle Federation', { align: 'center' });
        doc.moveDown(2);

        // Reference
        doc.fontSize(12).fillColor('#1f2937').text(`Reference: ${ticket.ticketNo}`, { align: 'center' });
        doc.fontSize(10).text(`Status: ${ticket.status}`, { align: 'center' });
        doc.moveDown(2);

        // Divider
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#e5e7eb');
        doc.moveDown();

        // === INCIDENT DETAILS ===
        doc.fontSize(12).fillColor('#047857').text('INCIDENT DETAILS');
        doc.moveDown(0.5);

        doc.fontSize(10).fillColor('#1f2937');
        doc.text(`Event: ${ticket.eventName || '-'}`);
        doc.text(`Type: ${ticket.type}`);
        doc.text(`Priority: ${ticket.priority || 'NORMAL'}`);
        doc.text(`Location: ${ticket.location || '-'}`);
        doc.text(`Date: ${new Date(ticket.createdAt).toLocaleString()}`);
        doc.text(`Reporter: ${ticket.createdBy?.name || 'Unknown'}`);
        if (ticket.createdBy?.mobile) doc.text(`Contact: ${ticket.createdBy.mobile}`);
        doc.moveDown();

        // === DESCRIPTION ===
        doc.fontSize(12).fillColor('#047857').text('DESCRIPTION');
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#1f2937').text(ticket.description || 'No description provided.', { align: 'justify' });
        doc.moveDown(2);

        // === MEDICAL REPORT ===
        if (ticket.medicalReport) {
            const m = ticket.medicalReport;

            doc.fontSize(12).fillColor('#047857').text('MEDICAL ASSESSMENT');
            doc.moveDown(0.5);

            doc.fontSize(10).fillColor('#1f2937');
            doc.text(`Patient: ${m.patientGivenName || ''} ${m.patientSurname || ''}`);
            if (m.patientDob) doc.text(`DOB: ${new Date(m.patientDob).toLocaleDateString()}`);
            if (m.patientGender) doc.text(`Gender: ${m.patientGender}`);
            if (m.patientRole) doc.text(`Role: ${m.patientRole.replace(/_/g, ' ')}`);
            if (m.carNumber) doc.text(`Car/Comp #: ${m.carNumber}`);
            if (m.injuryType) doc.text(`Injury Type: ${m.injuryType.replace(/_/g, ' ')}`);
            doc.moveDown(0.5);

            if (m.initialCondition) {
                doc.text('Condition on Arrival:', { underline: true });
                doc.text(m.initialCondition);
                doc.moveDown(0.5);
            }

            if (m.treatmentGiven) {
                doc.text('Treatment Given:', { underline: true });
                doc.text(m.treatmentGiven);
                doc.moveDown(0.5);
            }

            if (m.summary) {
                doc.text('Clinical Summary:', { underline: true });
                doc.text(m.summary);
                doc.moveDown(0.5);
            }

            if (m.recommendation) {
                doc.text('Recommendation:', { underline: true });
                doc.text(m.recommendation);
                doc.moveDown(0.5);
            }

            // LICENSE ACTION ALERT
            if (m.licenseAction && m.licenseAction !== 'NONE' && m.licenseAction !== 'CLEAR') {
                doc.moveDown();
                doc.fontSize(11).fillColor('#991b1b').text(`⚠ LICENSE ACTION: ${m.licenseAction.replace(/_/g, ' ')}`, {
                    align: 'center',
                    underline: true
                });
                doc.moveDown();
            }
        }

        // === ACTIVITY LOG ===
        if (ticket.activityLogs && ticket.activityLogs.length > 0) {
            doc.addPage();
            doc.fontSize(12).fillColor('#047857').text('ACTIVITY LOG');
            doc.moveDown(0.5);

            doc.fontSize(9).fillColor('#1f2937');
            ticket.activityLogs.forEach(log => {
                const date = new Date(log.createdAt).toLocaleString();
                const actor = log.actor?.name || 'System';
                doc.text(`[${date}] ${actor}: ${log.action.replace(/_/g, ' ')}`);
                if (log.details) doc.text(`   ${log.details}`, { indent: 20 });
                doc.moveDown(0.3);
            });
        }

        // === VERIFICATION FOOTER ===
        doc.addPage();
        doc.moveDown(5);

        doc.fontSize(14).fillColor('#047857').text('DOCUMENT VERIFICATION', { align: 'center' });
        doc.moveDown();

        doc.fontSize(9).fillColor('#6b7280').text(
            'This document has been digitally generated by the SAMF Incident Management System.',
            { align: 'center' }
        );
        doc.moveDown(2);

        // QR Code - SIMPLIFIED
        const verifyUrl = `${process.env.FRONTEND_URL || 'https://incident-system.vercel.app'}/verify/${verifyToken}`;
        try {
            console.log('[PDF] Generating QR code');
            const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
                width: 150,
                margin: 1,
                errorCorrectionLevel: 'L' // Lowest error correction for smaller size
            });
            doc.image(qrDataUrl, (doc.page.width - 120) / 2, doc.y, { width: 120 });
            doc.moveDown(10);
        } catch (qrErr) {
            console.error('[PDF] QR generation failed:', qrErr);
            doc.fontSize(10).fillColor('#991b1b').text('[QR Code generation failed]', { align: 'center' });
            doc.moveDown(2);
        }

        doc.fontSize(10).fillColor('#1f2937').text('Scan to verify authenticity', { align: 'center' });
        doc.moveDown();

        doc.fontSize(9).fillColor('#6b7280');
        doc.text(`Verification Token: ${verifyToken}`, { align: 'center' });
        doc.text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
        doc.moveDown(3);

        doc.fontSize(8).fillColor('#9ca3af').text(
            '© Saudi Automobile & Motorcycle Federation (SAMF) - All Rights Reserved',
            { align: 'center' }
        );
        doc.text('This is an official document. Unauthorized reproduction is prohibited.', { align: 'center' });

        console.log('[PDF] Finalizing document');
        doc.end();

    } catch (error) {
        console.error("[PDF] Export Error:", error);
        console.error("[PDF] Stack:", error.stack);
        if (!res.headersSent) {
            res.status(500).json({
                message: `Export failed: ${error.message}`,
                error: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }
};

const xlsx = require('xlsx');

// @desc    Export all tickets to Excel
// @route   GET /api/tickets/export-excel
// @access  Private
const exportExcel = async (req, res) => {
    try {
        // 1. Fetch All Tickets
        const tickets = await prisma.ticket.findMany({
            include: {
                createdBy: { select: { name: true } },
                medicalReport: true,
                pitGridReport: true
            },
            orderBy: { createdAt: 'desc' }
        });

        // 2. Transform to Flat Structure
        const data = tickets.map(t => ({
            'Ticket No': t.ticketNo,
            'Event': t.eventName,
            'Type': t.type,
            'Status': t.status,
            'Priority': t.priority,
            'Reporter': t.createdBy?.name || 'Unknown',
            'Description': t.description,
            'Assigned To': t.assignedToId || 'Unassigned',

            // Medical Specifics (Flattened if present)
            'Patient Name': t.medicalReport ? `${t.medicalReport.patientGivenName} ${t.medicalReport.patientSurname}` : '',
            'Injury Type': t.medicalReport?.injuryType || '',
            'License Action': t.medicalReport?.licenseAction || '',

            // Pit Specifics
            'Car No': t.pitGridReport?.carNumber || t.medicalReport?.carNumber || '',
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

        // 6. Send Response
        const fileName = `tickets_export_${Date.now()}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

        res.send(buffer);

    } catch (error) {
        console.error('Excel Export Error:', error);
        res.status(500).json({ message: 'Excel export failed' });
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
