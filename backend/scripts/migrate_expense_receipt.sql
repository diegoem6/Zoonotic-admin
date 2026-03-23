-- Migration: add receipt_file to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_file VARCHAR(500);
