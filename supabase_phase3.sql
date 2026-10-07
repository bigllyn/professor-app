-- Fase 3: Tabela de Aulas / Agenda (Lessons) - AUDITADO E REVISADO

-- ==========================================
-- TABELA: LESSONS (AULAS)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.lessons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL, -- Se a escola for deletada, a aula não some, vira "sem vínculo" ou "particular" para preservar o histórico
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL, -- Turma (opcional)
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL, -- Disciplina (opcional)
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL, -- Aluno 1x1 (opcional)
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT check_time_order CHECK (end_time > start_time)
);

-- Índices de performance para Lessons (Garantem velocidade na renderização da agenda diária)
CREATE INDEX IF NOT EXISTS idx_lessons_teacher_date ON public.lessons(teacher_id, date);
CREATE INDEX IF NOT EXISTS idx_lessons_school_id ON public.lessons(school_id);
CREATE INDEX IF NOT EXISTS idx_lessons_class_id ON public.lessons(class_id);
CREATE INDEX IF NOT EXISTS idx_lessons_student_id ON public.lessons(student_id);
CREATE INDEX IF NOT EXISTS idx_lessons_subject_id ON public.lessons(subject_id);

-- Trigger de updated_at para Lessons seguro para reexecução
DROP TRIGGER IF EXISTS on_lessons_updated ON public.lessons;
CREATE TRIGGER on_lessons_updated
    BEFORE UPDATE ON public.lessons
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS para Lessons
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view own lessons" ON public.lessons;
CREATE POLICY "Teachers can view own lessons" ON public.lessons
    FOR SELECT USING (
        auth.uid() = lessons.teacher_id 
        AND (
            lessons.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = lessons.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
    );

DROP POLICY IF EXISTS "Teachers can insert own lessons" ON public.lessons;
CREATE POLICY "Teachers can insert own lessons" ON public.lessons
    FOR INSERT WITH CHECK (
        auth.uid() = lessons.teacher_id 
        -- 1. Valida se pertence à escola
        AND (
            lessons.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = lessons.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
        -- 2. Valida se a turma pertence ao professor e ao mesmo contexto da aula
        AND (
            lessons.class_id IS NULL OR 
            EXISTS (
                SELECT 1 FROM public.classes c 
                WHERE c.id = lessons.class_id 
                AND c.teacher_id = auth.uid() 
                AND c.school_id IS NOT DISTINCT FROM lessons.school_id
            )
        )
        -- 3. Valida se a disciplina pertence ao professor e ao mesmo contexto da aula
        AND (
            lessons.subject_id IS NULL OR 
            EXISTS (
                SELECT 1 FROM public.subjects sub 
                WHERE sub.id = lessons.subject_id 
                AND sub.teacher_id = auth.uid() 
                AND sub.school_id IS NOT DISTINCT FROM lessons.school_id
            )
        )
        -- 4. Valida se o aluno pertence ao professor e ao mesmo contexto da aula
        AND (
            lessons.student_id IS NULL OR 
            EXISTS (
                SELECT 1 FROM public.students s 
                WHERE s.id = lessons.student_id 
                AND s.teacher_id = auth.uid() 
                AND s.school_id IS NOT DISTINCT FROM lessons.school_id
            )
        )
    );

DROP POLICY IF EXISTS "Teachers can update own lessons" ON public.lessons;
CREATE POLICY "Teachers can update own lessons" ON public.lessons
    FOR UPDATE USING (
        auth.uid() = lessons.teacher_id 
        AND (
            lessons.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = lessons.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
    ) WITH CHECK (
        auth.uid() = lessons.teacher_id 
        -- 1. Valida se pertence à escola
        AND (
            lessons.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = lessons.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
        -- 2. Valida se a turma pertence ao professor e ao mesmo contexto da aula
        AND (
            lessons.class_id IS NULL OR 
            EXISTS (
                SELECT 1 FROM public.classes c 
                WHERE c.id = lessons.class_id 
                AND c.teacher_id = auth.uid() 
                AND c.school_id IS NOT DISTINCT FROM lessons.school_id
            )
        )
        -- 3. Valida se a disciplina pertence ao professor e ao mesmo contexto da aula
        AND (
            lessons.subject_id IS NULL OR 
            EXISTS (
                SELECT 1 FROM public.subjects sub 
                WHERE sub.id = lessons.subject_id 
                AND sub.teacher_id = auth.uid() 
                AND sub.school_id IS NOT DISTINCT FROM lessons.school_id
            )
        )
        -- 4. Valida se o aluno pertence ao professor e ao mesmo contexto da aula
        AND (
            lessons.student_id IS NULL OR 
            EXISTS (
                SELECT 1 FROM public.students s 
                WHERE s.id = lessons.student_id 
                AND s.teacher_id = auth.uid() 
                AND s.school_id IS NOT DISTINCT FROM lessons.school_id
            )
        )
    );

DROP POLICY IF EXISTS "Teachers can delete own lessons" ON public.lessons;
CREATE POLICY "Teachers can delete own lessons" ON public.lessons
    FOR DELETE USING (
        auth.uid() = lessons.teacher_id 
        AND (
            lessons.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = lessons.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
    );
