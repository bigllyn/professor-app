-- Migration: Adicionar campos de presença em lesson_students
-- Arquivo: scratch/professor/supabase_phase4_b3.sql
-- Não destrutivo, preserva dados e políticas RLS

BEGIN;

-- Adiciona os campos de status e anotações
ALTER TABLE public.lesson_students 
ADD COLUMN attendance_status TEXT NOT NULL DEFAULT 'present' 
CHECK (attendance_status IN ('present', 'absent', 'justified'));

ALTER TABLE public.lesson_students 
ADD COLUMN attendance_notes TEXT;

-- Nota: Como lesson_students já possui RLS configurado com policies estritas:
-- "permitir select/insert/update/delete apenas para auth.uid() = teacher_id"
-- O novo campo herda essa mesma proteção sem necessidade de alterar as policies.
-- A trigger de imutabilidade 'enforce_lesson_students_immutability' já protege 
-- de forma dinâmica os IDs históricos, permitindo atualizações de status.

COMMIT;
