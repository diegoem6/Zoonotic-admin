-- =============================================
-- EMPRESA MANAGEMENT APP - DATABASE SCHEMA
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  rut VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_referentes (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(100)
);

-- Collaborators
CREATE TABLE IF NOT EXISTS collaborators (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  start_date DATE,
  email VARCHAR(255),
  condition VARCHAR(50) CHECK (condition IN ('Empleado', 'Contratado por horas', 'Coparticipante', 'Socio')),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'Falta Cotizar' CHECK (status IN ('Cobrado', 'Falta Cotizar', 'Falta OC', 'Facturado', 'En Ejecución')),
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  requestor VARCHAR(255),
  po VARCHAR(255),
  quote_file VARCHAR(500),
  type VARCHAR(50) CHECK (type IN ('Tiempo y materiales', 'Proyecto cerrado')),
  hours_estimated NUMERIC(10,2),
  iva_rate NUMERIC(5,4) DEFAULT 0.22,
  billing_date DATE,
  razon_social VARCHAR(50) CHECK (razon_social IN ('Zoonotic', 'Ingeuy')),
  invoice_number VARCHAR(100),
  currency VARCHAR(10) CHECK (currency IN ('USD', 'UYU')),
  subtotal_usd NUMERIC(15,2) DEFAULT 0,
  iva_usd NUMERIC(15,2) DEFAULT 0,
  total_usd NUMERIC(15,2) DEFAULT 0,
  subtotal_uyu NUMERIC(15,2) DEFAULT 0,
  iva_uyu NUMERIC(15,2) DEFAULT 0,
  total_uyu NUMERIC(15,2) DEFAULT 0,
  possible_payment_date DATE,
  actual_payment_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Project owners (Z2 = empresa misma, or collaborators)
CREATE TABLE IF NOT EXISTS project_owners (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('Z2', 'Colaborador')),
  collaborator_id INTEGER REFERENCES collaborators(id) ON DELETE CASCADE
);

-- Project hours (for Contratado por horas collaborators)
CREATE TABLE IF NOT EXISTS project_hours (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  collaborator_id INTEGER REFERENCES collaborators(id) ON DELETE CASCADE,
  hours NUMERIC(10,2) NOT NULL,
  date DATE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Expenses (Egresos)
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  description VARCHAR(500),
  amount NUMERIC(15,2) NOT NULL,
  currency VARCHAR(10) CHECK (currency IN ('USD', 'UYU')),
  collaborator_id INTEGER REFERENCES collaborators(id) ON DELETE SET NULL,
  comment TEXT,
  auto_generated BOOLEAN DEFAULT FALSE,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  type VARCHAR(50) DEFAULT 'Egreso' CHECK (type IN ('Egreso', 'Devolución')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Taxes / Contributions (Aportes e Impuestos)
CREATE TABLE IF NOT EXISTS taxes (
  id SERIAL PRIMARY KEY,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  razon_social VARCHAR(50) NOT NULL CHECK (razon_social IN ('Zoonotic', 'Ingeuy')),
  iva NUMERIC(15,2) DEFAULT 0,
  iva_manual_override BOOLEAN DEFAULT FALSE,
  irae NUMERIC(15,2) DEFAULT 0,
  patrimonio NUMERIC(15,2) DEFAULT 0,
  bps NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(month, year, razon_social)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_billing_date ON projects(billing_date);
CREATE INDEX IF NOT EXISTS idx_project_owners_project ON project_owners(project_id);
CREATE INDEX IF NOT EXISTS idx_project_hours_project ON project_hours(project_id);
CREATE INDEX IF NOT EXISTS idx_project_hours_collab ON project_hours(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_collaborator ON expenses(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_taxes_period ON taxes(year, month);
