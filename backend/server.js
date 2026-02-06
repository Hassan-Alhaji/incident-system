const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const authRoutes = require('./routes/authRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const reportRoutes = require('./routes/reportRoutes');
const medicalRoutes = require('./routes/medicalRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const publicRoutes = require('./routes/publicTicketRoutes');
const eventRoutes = require('./routes/eventRoutes');

// Middleware
app.use(cors());
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(morgan('dev'));
app.use(express.json());
app.use('/uploads', express.static('uploads')); // Serve uploaded files

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/verify', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/public', publicRoutes); // Public/Marshal Routes
app.use('/api/events', eventRoutes);

// Mount medical routes under /api/tickets/:id
app.use('/api/tickets/:id', medicalRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'Incident System API is running' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Keep-alive for some environments
setInterval(() => { }, 1000 * 60);
