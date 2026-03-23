-- Migration: add daily_rate and currency to project_viaticos
ALTER TABLE project_viaticos ADD COLUMN IF NOT EXISTS daily_rate NUMERIC(10,2);
ALTER TABLE project_viaticos ADD COLUMN IF NOT EXISTS currency   VARCHAR(10);
