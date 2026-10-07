-- Migration: Criar tabela de financeiro para aulas particulares
-- Arquivo: scratch/professor/supabase_phase5_financeiro.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.private_lesson_finances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
    lesson_id UUID NULL REFERENCES public.lessons(id) ON DELETE SET NULL,
    school_id UUID NULL, -- Sempre nulo para aulas particulares, mas o prompt especifica sua existência
    
    title TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    due_date DATE NULL,
    paid_at TIMESTAMPTZ NULL,
    notes TEXT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints vitais
    CONSTRAINT check_amount_positive CHECK (amount > 0),
    CONSTRAINT check_status_valid CHECK (status IN ('pending', 'paid', 'cancelled')),
    CONSTRAINT check_school_is_null CHECK (school_id IS NULL), -- Força que só pode ser particular
    CONSTRAINT check_paid_at_null_if_pending CHECK (status != 'pending' OR paid_at IS NULL)
);

-- Índices de performance e integridade
CREATE INDEX IF NOT EXISTS idx_private_finances_teacher ON public.private_lesson_finances(teacher_id);
CREATE INDEX IF NOT EXISTS idx_private_finances_student ON public.private_lesson_finances(student_id);
CREATE INDEX IF NOT EXISTS idx_private_finances_lesson ON public.private_lesson_finances(lesson_id);
CREATE INDEX IF NOT EXISTS idx_private_finances_status ON public.private_lesson_finances(status);
CREATE INDEX IF NOT EXISTS idx_private_finances_due_date ON public.private_lesson_finances(due_date);

-- Trigger para updated_at usando a função canônica
CREATE TRIGGER update_private_finances_updated_at
    BEFORE UPDATE ON public.private_lesson_finances
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.private_lesson_finances ENABLE ROW LEVEL SECURITY;

-- Select
CREATE POLICY "Professores podem ver seus próprios lançamentos"
    ON public.private_lesson_finances FOR SELECT
    USING (auth.uid() = teacher_id);

-- Insert
CREATE POLICY "Professores podem inserir seus próprios lançamentos"
    ON public.private_lesson_finances FOR INSERT
    WITH CHECK (
        auth.uid() = teacher_id
        AND EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_id
              AND s.teacher_id = auth.uid()
              AND s.school_id IS NULL
        )
        AND (
            lesson_id IS NULL OR EXISTS (
                SELECT 1 FROM public.lessons l
                WHERE l.id = lesson_id
                  AND l.teacher_id = auth.uid()
                  AND l.school_id IS NULL
                  AND (
                      l.student_id = student_id 
                      OR EXISTS (
                          SELECT 1 FROM public.lesson_students ls 
                          WHERE ls.lesson_id = l.id AND ls.student_id = student_id
                      )
                  )
            )
        )
    );

-- Update
CREATE POLICY "Professores podem atualizar seus próprios lançamentos"
    ON public.private_lesson_finances FOR UPDATE
    USING (auth.uid() = teacher_id)
    WITH CHECK (
        auth.uid() = teacher_id
        AND EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_id
              AND s.teacher_id = auth.uid()
              AND s.school_id IS NULL
        )
        AND (
            lesson_id IS NULL OR EXISTS (
                SELECT 1 FROM public.lessons l
                WHERE l.id = lesson_id
                  AND l.teacher_id = auth.uid()
                  AND l.school_id IS NULL
                  AND (
                      l.student_id = student_id 
                      OR EXISTS (
                          SELECT 1 FROM public.lesson_students ls 
                          WHERE ls.lesson_id = l.id AND ls.student_id = student_id
                      )
                  )
            )
        )
    );

-- Delete
CREATE POLICY "Professores podem excluir seus próprios lançamentos"
    ON public.private_lesson_finances FOR DELETE
    USING (auth.uid() = teacher_id);

COMMIT;
