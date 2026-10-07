-- Migration: Criar tabela de avaliações (assessments)
-- Arquivo: scratch/professor/supabase_phase4_b5.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    school_id UUID NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID NULL REFERENCES public.classes(id) ON DELETE SET NULL,
    subject_id UUID NULL REFERENCES public.subjects(id) ON DELETE SET NULL,
    lesson_id UUID NULL REFERENCES public.lessons(id) ON DELETE SET NULL,
    
    title TEXT NOT NULL,
    description TEXT NULL,
    score NUMERIC NULL,
    max_score NUMERIC NULL,
    assessment_date DATE NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints de validação
    CONSTRAINT check_score_positive CHECK (score IS NULL OR score >= 0),
    CONSTRAINT check_max_score_positive CHECK (max_score IS NULL OR max_score > 0),
    CONSTRAINT check_score_limits CHECK (
        score IS NULL OR max_score IS NULL OR score <= max_score
    )
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_assessments_teacher_id ON public.assessments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assessments_student_id ON public.assessments(student_id);
CREATE INDEX IF NOT EXISTS idx_assessments_lesson_id ON public.assessments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_assessments_school_id ON public.assessments(school_id);
CREATE INDEX IF NOT EXISTS idx_assessments_date ON public.assessments(assessment_date);

-- Trigger para updated_at
CREATE TRIGGER update_assessments_updated_at
    BEFORE UPDATE ON public.assessments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Habilitar RLS
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- Policy: Select
CREATE POLICY "Professores podem ver suas próprias avaliações"
    ON public.assessments FOR SELECT
    USING (auth.uid() = teacher_id);

-- Policy: Insert
CREATE POLICY "Professores podem inserir avaliações para si mesmos"
    ON public.assessments FOR INSERT
    WITH CHECK (auth.uid() = teacher_id);

-- Policy: Update
CREATE POLICY "Professores podem atualizar suas próprias avaliações"
    ON public.assessments FOR UPDATE
    USING (auth.uid() = teacher_id)
    WITH CHECK (auth.uid() = teacher_id);

-- Policy: Delete
CREATE POLICY "Professores podem excluir suas próprias avaliações"
    ON public.assessments FOR DELETE
    USING (auth.uid() = teacher_id);

COMMIT;
