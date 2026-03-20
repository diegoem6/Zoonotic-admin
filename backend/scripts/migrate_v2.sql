-- Migration v2: add iva_rate column if upgrading from v1
ALTER TABLE projects ADD COLUMN IF NOT EXISTS iva_rate NUMERIC(5,4) DEFAULT 0.22;
UPDATE projects SET iva_rate = 0.22 WHERE iva_rate IS NULL;
