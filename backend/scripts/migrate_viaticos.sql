-- Migration: create project_viaticos table
CREATE TABLE IF NOT EXISTS project_viaticos (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  collaborator_id INTEGER NOT NULL REFERENCES collaborators(id),
  description   TEXT,
  dias          NUMERIC(10,1) NOT NULL,
  date          DATE,
  created_at    TIMESTAMP DEFAULT NOW()
);
