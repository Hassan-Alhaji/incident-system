const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createTicket = async (req, res, type, reportDataField, reportData) => {
    try {
        const {
            marshalId,
            marshalMobile,
            postNumber,
            incidentDate, // YYYY-MM-DD
            incidentTime, // HH:mm
            description,
            location,
            eventId
        } = req.body;

        // Basic Validation
        if (!marshalId || !postNumber || !description) {
            return res.status(400).json({ error: 'Missing required fields (Marshal ID, Post #, Description)' });
        }

        // Generate a unique Ticket Number
        const date = new Date();
        const year = date.getFullYear();
        const uniqueSuffix = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
        const ticketNo = `INC-${year}-${uniqueSuffix}`;

        // Create the Ticket
        const ticket = await prisma.ticket.create({
            data: {
                ticketNo,
                type: type,
                status: 'OPEN',
                marshalId,
                marshalMobile,
                postNumber,
                incidentDate: incidentDate ? new Date(incidentDate) : new Date(),
                incidentTime: incidentTime || new Date().toTimeString().slice(0, 5),
                description,
                location: location || `Post ${postNumber}`,
                eventId,

                // Create the specific report nested using the CLEAN reportData passed in
                [reportDataField]: {
                    create: reportData
                }
            },
            include: {
                [reportDataField]: true
            }
        });

        // Handle Attachments
        if (req.files && req.files.length > 0) {
            const attachmentsData = req.files.map(file => ({
                ticketId: ticket.id,
                url: `/uploads/${file.filename}`,
                type: file.mimetype.startsWith('image/') ? 'IMAGE' : 'VIDEO',
                name: file.originalname,
                size: file.size,
                mimeType: file.mimetype
            }));

            await prisma.attachment.createMany({
                data: attachmentsData
            });
        }

        res.status(201).json({
            success: true,
            message: 'Ticket created successfully',
            ticketId: ticket.ticketNo,
            id: ticket.id
        });

    } catch (error) {
        console.error('Error creating public ticket:', error);
        res.status(500).json({ error: `Server Error: ${error.message}`, details: error.stack });
    }
};

exports.submitMedical = async (req, res) => {
    // Explicitly construct ONLY the fields valid for MedicalReport
    const {
        patientName, patientRole, injuryType, conscious, description
    } = req.body;

    const reportData = {
        patientName,
        patientRole,
        injuryType,
        consciousnessLevel: conscious === 'true' || conscious === true ? 'Conscious' : 'Unconscious',
        summary: description // Use description as summary
    };

    return createTicket(req, res, 'MEDICAL', 'medicalReport', reportData);
};

exports.submitControl = async (req, res) => {
    const {
        competitorNumber, violationType, lapNumber
    } = req.body;

    // Explicitly construct ONLY the fields valid for ControlReport
    const reportData = {
        competitorNumber,
        violationType,
        lapNumber: parseInt(lapNumber) || 0
    };

    return createTicket(req, res, 'SPORT', 'controlReport', reportData);
};

exports.submitSafety = async (req, res) => {
    const {
        hazardType, isTrackBlocked
    } = req.body;

    // Explicitly construct ONLY the fields valid for SafetyReport
    const reportData = {
        hazardType,
        trackStatus: isTrackBlocked === 'true' ? 'RED' : 'YELLOW'
    };

    return createTicket(req, res, 'SAFETY', 'safetyReport', reportData);
};
