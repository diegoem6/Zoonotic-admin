-- Migration: add hourly_rate and currency to project_hours
ALTER TABLE project_hours ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2);
ALTER TABLE project_hours ADD COLUMN IF NOT EXISTS currency    VARCHAR(10);
