-- Add notes field to tenants for super admin observations
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS notes TEXT;
