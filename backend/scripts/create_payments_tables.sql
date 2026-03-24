-- Tabla principal de pagos
CREATE TABLE IF NOT EXISTS payments (
  id              SERIAL PRIMARY KEY,
  date            DATE           NOT NULL,
  amount          NUMERIC(12,2)  NOT NULL,
  currency        VARCHAR(3)     NOT NULL DEFAULT 'USD',
  collaborator_id INTEGER        REFERENCES collaborators(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ    DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    DEFAULT NOW()
);

-- Items: qué parte de cada pago se aplica a qué egreso
CREATE TABLE IF NOT EXISTS payment_expense_items (
  id          SERIAL PRIMARY KEY,
  payment_id  INTEGER       NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  expense_id  INTEGER       NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL
);

-- Fecha en que el egreso fue completamente pagado
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_at DATE;
