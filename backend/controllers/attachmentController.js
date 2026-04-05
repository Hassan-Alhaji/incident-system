const prisma = require('../prismaClient');

const getAttachmentContent = async (req, res) => {
    try {
        const { id } = req.params;
        const attachment = await prisma.attachment.findUnique({
            where: { id: id },
            select: {
                data: true,
                mimeType: true
            }
        });

        if (!attachment || !attachment.data) {
            return res.status(404).send('Attachment content not found');
        }

        res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
        res.send(attachment.data);
    } catch (error) {
        console.error('Error fetching attachment content:', error);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = { getAttachmentContent };
