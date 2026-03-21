-- =========================================
-- SCRIPT DE SEED (DADOS INICIAIS)
-- Execute este script no SQL Editor do Supabase
-- =========================================

-- Inserindo a conta Master Admin
INSERT INTO users (
  id, 
  role, 
  name, 
  email, 
  "isRegistered", 
  "isMaster", 
  "passwordHash",
  status
) 
VALUES (
  uuid_generate_v4(), 
  'admin', 
  'Ivan Rossi Master', 
  'ivanrossi@outlook.com', 
  true, 
  true, 
  'ivanrossi',
  'active'
);
