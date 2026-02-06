const jwt = require('jsonwebtoken');
// In a real app, use bcrypt or argon2. For MVP/Propotype without native deps issues, we can use simple crypto or just bcryptjs if installed.
// I didn't install bcryptjs yet. I will install it now or use a placeholder if speed is key.
// Let's use bcryptjs for security best practice.
// Wait, I need to install bcryptjs.
const bcrypt = require('bcryptjs');

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

const comparePassword = async (enteredPassword, hashedPassword) => {
    return await bcrypt.compare(enteredPassword, hashedPassword);
};

module.exports = { generateToken, hashPassword, comparePassword };
