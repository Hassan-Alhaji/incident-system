const prisma = require('../prismaClient');
const logger = require('../lib/logger').child({ module: 'attachmentController' });

const getAttachmentContent = async (req, res) => {
    try {
        const { id } = req.params;
        const attachment = await prisma.attachment.findUnique({
            where: { id: id },
            select: {
                data: true,
                mimeType: true,
                name: true
            }
        });

        if (!attachment || !attachment.data) {
            return res.status(404).send('Attachment content not found');
        }

        const safeInlineMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        const isSafeInline = safeInlineMimeTypes.includes(attachment.mimeType);
        const disposition = isSafeInline ? 'inline' : 'attachment';

        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'none'; sandbox;");
        res.setHeader('Content-Type', isSafeInline ? attachment.mimeType : 'application/octet-stream');
        res.setHeader('Content-Disposition', `${disposition}; filename="${attachment.name || 'attachment'}"`);
        
        res.send(attachment.data);
    } catch (error) {
        logger.error({ err: error }, 'Error fetching attachment content:');
        res.status(500).send('Internal Server Error');
    }
};

module.exports = { getAttachmentContent };
