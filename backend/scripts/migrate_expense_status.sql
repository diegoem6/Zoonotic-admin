-- Migration: add payment_status to expenses
-- Values: 'pendiente' | 'pagado'
-- An expense is considered effective (affects cashflow) only when payment_status = 'pagado'

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'pendiente';

-- Migrate all existing expenses to 'pagado'
UPDATE expenses SET payment_status = 'pagado';
