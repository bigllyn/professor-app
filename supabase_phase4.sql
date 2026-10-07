-- Fase 4: Tabela de Conteúdos da Aula (Lesson Contents)

-- ==========================================
-- TABELA: LESSON_CONTENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.lesson_contents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    school_id UUID REFERENCES public.schools(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT,
    observations TEXT,
    sequence_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- ÍNDICES DE PERFORMANCE
-- ==========================================
-- Nota: O índice composto (lesson_id, sequence_order) já cobre buscas exclusivas por lesson_id (left-prefix),
-- mas os três índices solicitados foram criados conforme a modelagem.
CREATE INDEX IF NOT EXISTS idx_lesson_contents_lesson_id ON public.lesson_contents(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_contents_teacher_id ON public.lesson_contents(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lesson_contents_lesson_seq ON public.lesson_contents(lesson_id, sequence_order);

-- ==========================================
-- TRIGGER: UPDATED_AT
-- ==========================================
DROP TRIGGER IF EXISTS on_lesson_contents_updated ON public.lesson_contents;
CREATE TRIGGER on_lesson_contents_updated
    BEFORE UPDATE ON public.lesson_contents
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE public.lesson_contents ENABLE ROW LEVEL SECURITY;

-- SELECT
DROP POLICY IF EXISTS "Teachers can view own lesson contents" ON public.lesson_contents;
CREATE POLICY "Teachers can view own lesson contents" ON public.lesson_contents
    FOR SELECT USING (
        auth.uid() = lesson_contents.teacher_id 
        AND (
            lesson_contents.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = lesson_contents.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
    );

-- INSERT
DROP POLICY IF EXISTS "Teachers can insert own lesson contents" ON public.lesson_contents;
CREATE POLICY "Teachers can insert own lesson contents" ON public.lesson_contents
    FOR INSERT WITH CHECK (
        auth.uid() = lesson_contents.teacher_id 
        -- 1. Verifica contexto de escola/particular
        AND (
            lesson_contents.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = lesson_contents.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
        -- 2. Barreira absoluta de integridade contra a aula-pai
        AND EXISTS (
            SELECT 1 FROM public.lessons l 
            WHERE l.id = lesson_contents.lesson_id 
              AND l.teacher_id = auth.uid() -- Aula deve pertencer a quem chama
              AND l.teacher_id = lesson_contents.teacher_id -- teacher_id deve ser idêntico
              AND l.school_id IS NOT DISTINCT FROM lesson_contents.school_id -- Contexto deve ser idêntico
        )
    );

-- UPDATE
DROP POLICY IF EXISTS "Teachers can update own lesson contents" ON public.lesson_contents;
CREATE POLICY "Teachers can update own lesson contents" ON public.lesson_contents
    FOR UPDATE USING (
        -- USING: Condição para ENCONTRAR a linha a ser atualizada
        auth.uid() = lesson_contents.teacher_id 
        AND (
            lesson_contents.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = lesson_contents.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
    ) WITH CHECK (
        -- WITH CHECK: Condição que os NOVOS dados devem respeitar após atualização
        auth.uid() = lesson_contents.teacher_id 
        -- 1. Verifica contexto de escola/particular do novo dado
        AND (
            lesson_contents.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = lesson_contents.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
        -- 2. Impede mover conteúdo entre aulas de outros professores/contextos
        AND EXISTS (
            SELECT 1 FROM public.lessons l 
            WHERE l.id = lesson_contents.lesson_id 
              AND l.teacher_id = auth.uid()
              AND l.teacher_id = lesson_contents.teacher_id 
              AND l.school_id IS NOT DISTINCT FROM lesson_contents.school_id
        )
    );

-- DELETE
DROP POLICY IF EXISTS "Teachers can delete own lesson contents" ON public.lesson_contents;
CREATE POLICY "Teachers can delete own lesson contents" ON public.lesson_contents
    FOR DELETE USING (
        auth.uid() = lesson_contents.teacher_id 
        AND (
            lesson_contents.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = lesson_contents.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
    );
