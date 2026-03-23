-- Migration: add comments column to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS comments TEXT;
