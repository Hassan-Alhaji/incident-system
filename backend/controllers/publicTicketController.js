const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Map severity to priority enum
const priorityMap = { MINOR: 'MINOR', SIGNIFICANT: 'SIGNIFICANT', MAJOR: 'MAJOR', SEVERE: 'SEVERE', RED: 'SEVERE', YELMINOR: 'MAJOR', GREEN: 'SIGNIFICANT' };

// Utility function to calculate SLAs based on SMC HSE rules
const calculateDueDate = (severity) => {
    const now = new Date();
    if (severity === 'RED' || severity === 'SEVERE') {
        // Red / Serious: 24 hours initial response
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    } else if (severity === 'YELMINOR' || severity === 'MAJOR') {
        // Yellow / Significant: 1 Week
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else {
        // Green / Minor / MINOR: 2 Weeks
        return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    }
};

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
                status: 'HSE_REVIEW', // Phase 1 Routing: All new tickets go to HSE Controller
                priority: req.body.severity ? priorityMap[req.body.severity] : 'SIGNIFICANT',
                marshalId,
                marshalMobile,
                postNumber,
                incidentDate: incidentDate ? new Date(incidentDate) : new Date(),
                incidentTime: incidentTime || new Date().toTimeString().slice(0, 5),
                description,
                location: location || `Post ${postNumber}`,
                eventId,
                severityLevel: req.body.severity || 'YELMINOR',
                dueDate: calculateDueDate(req.body.severity),
                serviceProviderId: req.body.serviceProviderId || null,
                zoneId: req.body.zoneId || null,

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
        trackStatus: isTrackBlocked === 'true' ? 'RED' : 'YELMINOR'
    };

    return createTicket(req, res, 'SAFETY', 'safetyReport', reportData);
};
