const request = require('supertest');
const app = require('../../server');
const prisma = require('../../prismaClient');

// Mock Prisma
jest.mock('../../prismaClient', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  }
}));

// Mock Email Service to prevent actual emails from sending during tests
jest.mock('../../utils/emailService', () => ({
  sendOTP: jest.fn().mockResolvedValue(true)
}));

describe('Authentication API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/otp/request', () => {
    it('should return 400 if email is missing', async () => {
      const res = await request(app).post('/api/auth/otp/request').send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Email is required');
    });

    it('should generate OTP and save to valid user', async () => {
      // Mock existing user
      prisma.user.findUnique.mockResolvedValue({ id: 'user123', email: 'test@example.com', status: 'ACTIVE' });
      prisma.user.update.mockResolvedValue({}); // mock successful update

      const res = await request(app).post('/api/auth/otp/request').send({ email: 'test@example.com' });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('testCode');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user123' },
          data: expect.objectContaining({
            otpCode: expect.any(String),
            otpExpires: expect.any(Date)
          })
        })
      );
    });

    it('should block suspended users', async () => {
      // Mock suspended user
      prisma.user.findUnique.mockResolvedValue({ id: 'user123', email: 'banned@example.com', status: 'SUSPENDED' });

      const res = await request(app).post('/api/auth/otp/request').send({ email: 'banned@example.com' });
      
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/deactivated/);
    });
  });

  describe('POST /api/auth/otp/verify', () => {
    it('should reject invalid OTP', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        otpCode: '1234',
        otpExpires: new Date(Date.now() + 10000)
      });

      const res = await request(app).post('/api/auth/otp/verify').send({ email: 'test@example.com', otp: '9999' });
      
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid code');
    });

    it('should reject expired OTP', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        otpCode: '1234',
        otpExpires: new Date(Date.now() - 10000) // EXPIRED
      });

      const res = await request(app).post('/api/auth/otp/verify').send({ email: 'test@example.com', otp: '1234' });
      
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Code expired');
    });

    it('should login and return generic token logic successfully', async () => {
       prisma.user.findUnique.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        otpCode: '1234',
        role: 'ADMIN',
        otpExpires: new Date(Date.now() + 10000)
      });

      prisma.user.update.mockResolvedValue({
        id: 'user123', email: 'test@example.com', role: 'ADMIN'
      });

      const res = await request(app).post('/api/auth/otp/verify').send({ email: 'test@example.com', otp: '1234' });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.role).toBe('ADMIN');
    });
  });
});
