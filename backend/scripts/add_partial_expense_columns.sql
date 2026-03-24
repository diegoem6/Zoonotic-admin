-- Columnas para soporte de egresos parciales (hijos de un egreso pendiente)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_partial         BOOLEAN  NOT NULL DEFAULT FALSE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS parent_expense_id  INTEGER  REFERENCES expenses(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source_payment_id  INTEGER  REFERENCES payments(id);
