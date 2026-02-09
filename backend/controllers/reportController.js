const prisma = require('../prismaClient');

// @desc    Export ticket report to PDF (Basic implementation / Placeholder)
// @route   POST /api/tickets/:id/export-pdf
// @access  Private
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

// @desc    Export ticket report to PDF
// @route   POST /api/tickets/:id/export-pdf
// @access  Private
const exportPdf = async (req, res) => {
    const ticketId = req.params.id;

    try {
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

        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const verifyToken = Math.random().toString(36).substring(2, 10).toUpperCase();

        const chunks = [];
        const doc = new PDFDocument({ size: 'A4', margin: 40 }); // Removed bufferPages

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            const fileName = `report-${ticket.ticketNo}.pdf`;

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.setHeader('Content-Length', pdfBuffer.length);
            res.send(pdfBuffer);
        });

        // Log export (fire & forget - don't await)
        prisma.ticketExport.create({
            data: {
                ticketId,
                verifyToken,
                pdfUrl: 'BUFFERED',
                snapshotJson: JSON.stringify({ id: ticket.id, ticketNo: ticket.ticketNo })
            }
        }).catch(e => console.error('Export log error:', e));

        // === STYLES ===
        const colors = {
            textMain: '#1f2937', // Dark charcoal
            textLight: '#6b7280', // Medium gray
            accent: '#047857',    // Emerald green (muted)
            bgLight: '#f9fafb',   // Very light gray
            border: '#e5e7eb',    // Light border
            alertBg: '#fef2f2',   // Light red bg
            alertText: '#991b1b'  // Dark red text
        };

        const FONTS = {
            regular: 'Helvetica',
            bold: 'Helvetica-Bold'
        };

        const MARGIN = 40;
        const PAGE_WIDTH = 595.28;
        const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

        // === HELPERS ===

        const checkPageBreak = (heightNeeded) => {
            if (doc.y + heightNeeded > doc.page.height - MARGIN) {
                doc.addPage();
                return true;
            }
            return false;
        };

        const drawSectionTitle = (title) => {
            checkPageBreak(40);
            doc.moveDown(1);
            doc.font(FONTS.bold).fontSize(11).fillColor(colors.textMain).text(title.toUpperCase(), MARGIN);
            doc.rect(MARGIN, doc.y + 2, CONTENT_WIDTH, 1).fill(colors.border);
            doc.y += 10;
        };

        const drawLabelValue = (label, value, x, y, width, isBoldValue = false) => {
            doc.font(FONTS.bold).fontSize(7).fillColor(colors.textLight).text(label.toUpperCase(), x, y);
            doc.font(isBoldValue ? FONTS.bold : FONTS.regular).fontSize(9).fillColor(colors.textMain)
                .text(value || '-', x, y + 10, { width: width, ellipsis: true });
        };

        // === HEADER (Compact) ===
        // Logo Placeholder
        doc.rect(MARGIN, 40, 40, 40).fill(colors.bgLight).stroke(colors.border);
        doc.font(FONTS.bold).fontSize(6).fillColor(colors.textLight).text('SAMF', MARGIN + 8, 55);

        // Title Block
        doc.font(FONTS.bold).fontSize(16).fillColor(colors.textMain).text('OFFICIAL INCIDENT REPORT', MARGIN + 55, 45);
        doc.font(FONTS.regular).fontSize(9).fillColor(colors.textLight).text('Saudi Automobile & Motorcycle Federation', MARGIN + 55, 65);

        // Reference Box (Top Right)
        doc.font(FONTS.bold).fontSize(9).fillColor(colors.textMain).text(`REF: ${ticket.ticketNo}`, PAGE_WIDTH - MARGIN - 120, 45, { width: 120, align: 'right' });

        // Status Badge
        const statusColor = ticket.status === 'CLOSED' ? colors.textLight : colors.accent;
        doc.rect(PAGE_WIDTH - MARGIN - 80, 60, 80, 16).fill(colors.bgLight);
        doc.font(FONTS.bold).fontSize(8).fillColor(statusColor).text(ticket.status, PAGE_WIDTH - MARGIN - 80, 64, { width: 80, align: 'center' });

        doc.y = 100;

        // === METADATA GRID ===
        // Background for grid
        doc.rect(MARGIN, doc.y, CONTENT_WIDTH, 70).fill(colors.bgLight);

        const row1Y = doc.y + 10;
        const row2Y = doc.y + 40;
        const col1X = MARGIN + 10;
        const col2X = MARGIN + 160;
        const col3X = MARGIN + 310;
        const col4X = MARGIN + 430;

        drawLabelValue('Event Name', ticket.eventName, col1X, row1Y, 140, true);
        drawLabelValue('Location/Venue', ticket.location, col2X, row1Y, 140);
        drawLabelValue('Type', ticket.type, col3X, row1Y, 110);
        drawLabelValue('Priority', ticket.priority, col4X, row1Y, 80, true);

        drawLabelValue('Date Reported', new Date(ticket.createdAt).toLocaleString(), col1X, row2Y, 140);
        drawLabelValue('Reporter', ticket.createdBy?.name, col2X, row2Y, 140);
        drawLabelValue('Contact', ticket.createdBy?.mobile || ticket.createdBy?.email, col3X, row2Y, 150);

        doc.y += 85;

        // === DESCRIPTION ===
        drawSectionTitle('Indicator Description');
        doc.font(FONTS.regular).fontSize(9).fillColor(colors.textMain)
            .text(ticket.description || 'No description provided.', MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'justify' });
        doc.y += 10;

        // === MEDICAL REPORT (If present) ===
        if (ticket.medicalReport) {
            checkPageBreak(150);
            const m = ticket.medicalReport;
            drawSectionTitle('Medical Assessment');

            // Patient Info Box
            const boxHeight = 50;
            doc.rect(MARGIN, doc.y, CONTENT_WIDTH, boxHeight).stroke(colors.border);

            const medY = doc.y + 10;
            drawLabelValue('Patient Name', `${m.patientGivenName || ''} ${m.patientSurname || ''}`, col1X, medY, 140, true);
            drawLabelValue('Role', m.patientRole?.replace(/_/g, ' '), col2X, medY, 140);
            drawLabelValue('Car/Comp #', m.carNumber || '-', col3X, medY, 80);
            drawLabelValue('Gender/DOB', `${m.patientGender || '-'} / ${m.patientDob ? new Date(m.patientDob).toLocaleDateString() : '-'}`, col4X, medY, 100);

            doc.y += boxHeight + 15;

            // Clinical Details
            const drawTextBlock = (label, text) => {
                checkPageBreak(40);
                doc.font(FONTS.bold).fontSize(8).fillColor(colors.textLight).text(label + ':', MARGIN);
                doc.font(FONTS.regular).fontSize(9).fillColor(colors.textMain).text(text || 'N/A', MARGIN + 100, doc.y - 8, { width: CONTENT_WIDTH - 100 });
                doc.y += 5;
            };

            drawTextBlock('Injury Type', m.injuryType?.replace(/_/g, ' '));
            drawTextBlock('Condition', m.initialCondition);
            drawTextBlock('Treatment', m.treatmentGiven);
            drawTextBlock('Summary', m.summary);
            doc.y += 10;

            // LICENSE ACTION ALERT
            if (m.licenseAction && m.licenseAction !== 'NONE' && m.licenseAction !== 'CLEAR') {
                checkPageBreak(40);
                doc.rect(MARGIN, doc.y, CONTENT_WIDTH, 30).fill(colors.alertBg);
                doc.rect(MARGIN, doc.y, 4, 30).fill(colors.alertText); // Red Side marker

                doc.font(FONTS.bold).fontSize(10).fillColor(colors.alertText)
                    .text(`LICENSE ACTION REQUIRED: ${m.licenseAction.replace(/_/g, ' ')}`, MARGIN + 15, doc.y + 10);
                doc.y += 40;
            }
        }

        // === ATTACHMENTS (Grid Layout) ===
        if (ticket.attachments && ticket.attachments.length > 0) {
            checkPageBreak(120);
            drawSectionTitle('Photographic Evidence');

            let currentX = MARGIN;
            const imgWidth = (CONTENT_WIDTH - 20) / 2; // 2 per row
            const imgHeight = 140;

            // LIMIT TO 2 IMAGES MAX for serverless compatibility
            const maxImages = 2;
            let processedImages = 0;

            for (const att of ticket.attachments) {
                if (processedImages >= maxImages) break;

                // Determine layout
                if (currentX > MARGIN + 100) {
                    // Start new row
                    currentX = MARGIN;
                    doc.y += imgHeight + 30;
                }

                // Check Page Break for Image
                if (doc.y + imgHeight > doc.page.height - MARGIN) {
                    doc.addPage();
                    doc.y = MARGIN + 20; // Reset Y
                }

                // Resolve Path
                let imagePath = null;
                if (att.url && att.url.startsWith('/uploads/')) {
                    imagePath = path.join(__dirname, '..', att.url);
                } else if (att.url) {
                    imagePath = path.join(__dirname, '..', 'uploads', path.basename(att.url));
                }

                // Draw Container
                doc.rect(currentX, doc.y, imgWidth, imgHeight).stroke(colors.border);

                // Draw Image (simplified)
                if (imagePath && fs.existsSync(imagePath)) {
                    try {
                        const ext = path.extname(imagePath).toLowerCase();
                        if (['.jpg', '.jpeg', '.png'].includes(ext)) {
                            doc.image(imagePath, currentX + 5, doc.y + 5, {
                                fit: [imgWidth - 10, imgHeight - 30],
                                align: 'center',
                                valign: 'center'
                            });
                            processedImages++;
                        }
                    } catch (e) {
                        console.error('Image error:', e);
                        doc.fontSize(8).text('[Img Error]', currentX + 5, doc.y + 5);
                    }
                } else {
                    doc.fontSize(8).text('Image not found', currentX + 5, doc.y + 50, { align: 'center', width: imgWidth });
                }

                // Caption
                doc.fontSize(7).fillColor(colors.textLight)
                    .text(att.filename || 'Attachment', currentX + 5, doc.y + imgHeight - 20, { width: imgWidth - 10, align: 'center', height: 15, ellipsis: true });

                currentX += imgWidth + 20;
            }

            // Note if more images exist
            if (ticket.attachments.length > maxImages) {
                doc.fontSize(8).fillColor(colors.textLight)
                    .text(`+ ${ticket.attachments.length - maxImages} more attachment(s) not shown`, MARGIN, doc.y + imgHeight + 10);
            }

            // Reset Y after grid
            if (currentX > MARGIN) doc.y += imgHeight + 30; // Close last row
        }

        // === ACTIVITY LOG (Vertical Timeline) ===
        if (ticket.activityLogs && ticket.activityLogs.length > 0) {
            checkPageBreak(100);
            drawSectionTitle('Audit Timeline');

            // Timeline line
            const lineX = MARGIN + 60;
            const startY = doc.y;

            ticket.activityLogs.forEach((log) => {
                checkPageBreak(30);
                const itemY = doc.y;

                // Timestamp (Left)
                doc.font(FONTS.regular).fontSize(7).fillColor(colors.textLight)
                    .text(new Date(log.createdAt).toLocaleDateString(), MARGIN, itemY, { width: 50, align: 'right' });
                doc.text(new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), MARGIN, itemY + 8, { width: 50, align: 'right' });

                // Dot on line
                doc.circle(lineX, itemY + 6, 2).fill(colors.border);

                // Content (Right of line)
                doc.font(FONTS.bold).fontSize(8).fillColor(colors.textMain)
                    .text(log.action.replace(/_/g, ' '), lineX + 15, itemY);

                doc.font(FONTS.regular).fontSize(8).fillColor(colors.textLight)
                    .text(`${log.actor?.name || 'System'} - ${log.details || ''}`, lineX + 15, itemY + 10, { width: 350 });

                doc.y += 25; // Space between items
            });

            // Draw connecting line
            if (doc.y > startY) {
                doc.save();
                doc.strokeColor(colors.border).lineWidth(1)
                    .moveTo(lineX, startY)
                    .lineTo(lineX, doc.y - 15)
                    .stroke();
                doc.restore();
            }
        }

        // === VERIFICATION (Footer / Compact) ===
        const verifyHeight = 120;
        if (doc.y + verifyHeight > doc.page.height - MARGIN) {
            doc.addPage();
            doc.y = doc.page.height - verifyHeight - MARGIN;
        } else {
            doc.moveDown(2);
        }

        // Separator
        doc.moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).stroke(colors.border);
        doc.y += 20;

        // Container
        const footerY = doc.y;

        // QR Code (Left)
        const verifyUrl = `${process.env.FRONTEND_URL || 'https://incident-system.vercel.app'}/verify/${verifyToken}`;
        try {
            const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 80, margin: 0 });
            doc.image(qrDataUrl, MARGIN, footerY, { width: 60 });
        } catch (e) { }

        // Text (Right of QR)
        doc.font(FONTS.bold).fontSize(9).fillColor(colors.textMain)
            .text('AUTHENTICITY VERIFICATION', MARGIN + 80, footerY);

        doc.font(FONTS.regular).fontSize(7).fillColor(colors.textLight)
            .text('Scan the QR code to verify the validity of this digital report on the SAMF Incident Portal. Unauthorized modification is invalid.', MARGIN + 80, footerY + 15, { width: 350 });

        doc.font(FONTS.bold).fontSize(7).fillColor(colors.accent)
            .text(`TOKEN: ${verifyToken}`, MARGIN + 80, footerY + 40);

        doc.font(FONTS.regular).fontSize(7).fillColor(colors.textLight)
            .text(`Generated: ${new Date().toISOString()}`, MARGIN + 80, footerY + 50);

        // Finalize
        doc.end();

    } catch (error) {
        console.error("PDF Export Error:", error);
        console.error("Stack:", error.stack);
        if (!res.headersSent) {
            res.status(500).json({ message: `Export failed: ${error.message}`, stack: error.stack });
        }
    }
};

const xlsx = require('xlsx');

// @desc    Export tickets to Excel
// @route   GET /api/tickets/export-excel
// @access  Private (Admin/COC)
const exportExcel = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // 1. Validation & Filter
        const where = {};
        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate)
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

        // 3. Transform Data for Excel
        const data = tickets.map(t => ({
            'Ticket No': t.ticketNo,
            'Event': t.eventName,
            'Open Date': new Date(t.createdAt).toLocaleDateString(),
            'Closed Date': t.closedAt ? new Date(t.closedAt).toLocaleDateString() : '-',
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
