-- Migration: Adicionar campos de desempenho em lesson_students
-- Arquivo: scratch/professor/supabase_phase4_b4.sql
-- Não destrutivo, preserva dados e políticas RLS

BEGIN;

ALTER TABLE public.lesson_students 
ADD COLUMN performance_level TEXT 
CHECK (performance_level IN ('excellent', 'good', 'needs_attention'));

ALTER TABLE public.lesson_students 
ADD COLUMN performance_notes TEXT;

-- Nota: Herda automaticamente a política de segurança (RLS) existente em lesson_students,
-- que permite acesso/modificação apenas quando teacher_id = auth.uid().
-- A trigger de imutabilidade também permite atualizações de campos adicionais como este.

COMMIT;
