-- Migration: add_otp_attempts_brute_force
-- Adds otpAttempts field to User table for brute-force OTP protection.
-- Safe: existing rows get default value 0, no data is lost.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "otpAttempts" INTEGER NOT NULL DEFAULT 0;
