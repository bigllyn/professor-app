-- Fase 4 (Bloco 2): Tabela de Presença/Participação da Aula (Lesson Students)

-- ==========================================
-- TABELA: LESSON_STUDENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.lesson_students (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    student_id UUID NULL REFERENCES public.students(id) ON DELETE SET NULL,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    school_id UUID NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
    class_id UUID NULL REFERENCES public.classes(id) ON DELETE SET NULL,
    
    student_name_snapshot TEXT NOT NULL,
    class_name_snapshot TEXT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- ÍNDICE ÚNICO PARCIAL (Anti-Duplicidade)
-- ==========================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_lesson_students_unique_lesson_student
    ON public.lesson_students(lesson_id, student_id)
    WHERE student_id IS NOT NULL;

-- ==========================================
-- ÍNDICES DE PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_lesson_students_lesson_id ON public.lesson_students(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_students_student_id ON public.lesson_students(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_students_class_id ON public.lesson_students(class_id);
CREATE INDEX IF NOT EXISTS idx_lesson_students_teacher_id ON public.lesson_students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_lesson_students_teacher_school ON public.lesson_students(teacher_id, school_id);

-- ==========================================
-- TRIGGER: UPDATED_AT
-- ==========================================
DROP TRIGGER IF EXISTS on_lesson_students_updated ON public.lesson_students;
CREATE TRIGGER on_lesson_students_updated
    BEFORE UPDATE ON public.lesson_students
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE public.lesson_students ENABLE ROW LEVEL SECURITY;

-- SELECT
DROP POLICY IF EXISTS "Teachers can view own lesson students" ON public.lesson_students;
CREATE POLICY "Teachers can view own lesson students" ON public.lesson_students
    FOR SELECT USING (
        auth.uid() = lesson_students.teacher_id 
        AND (
            lesson_students.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = lesson_students.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
    );

-- INSERT
DROP POLICY IF EXISTS "Teachers can insert own lesson students" ON public.lesson_students;
CREATE POLICY "Teachers can insert own lesson students" ON public.lesson_students
    FOR INSERT WITH CHECK (
        -- 1. Pertence ao professor logado
        auth.uid() = lesson_students.teacher_id 
        -- Contexto de escola ou particular
        AND (
            lesson_students.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = lesson_students.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
        -- 2, 3, 4, 5, 8: Integridade pai (Lesson) e Coerência de class_id
        AND EXISTS (
            SELECT 1 FROM public.lessons l 
            WHERE l.id = lesson_students.lesson_id 
              AND l.teacher_id = auth.uid()
              AND l.teacher_id = lesson_students.teacher_id 
              AND l.school_id IS NOT DISTINCT FROM lesson_students.school_id
              AND l.class_id IS NOT DISTINCT FROM lesson_students.class_id
        )
        -- 6 e 9: Validação de Student e Snapshot
        AND (
            lesson_students.student_id IS NULL OR
            EXISTS (
                SELECT 1 FROM public.students s 
                WHERE s.id = lesson_students.student_id 
                  AND s.teacher_id = auth.uid()
                  AND s.school_id IS NOT DISTINCT FROM lesson_students.school_id
                  AND s.name = lesson_students.student_name_snapshot
            )
        )
        -- 7 e 10: Validação de Class e Snapshot
        AND (
            (lesson_students.class_id IS NULL AND lesson_students.class_name_snapshot IS NULL) OR
            EXISTS (
                SELECT 1 FROM public.classes c 
                WHERE c.id = lesson_students.class_id 
                  AND c.teacher_id = auth.uid()
                  AND c.school_id IS NOT DISTINCT FROM lesson_students.school_id
                  AND c.name = lesson_students.class_name_snapshot
            )
        )
    );

-- UPDATE
DROP POLICY IF EXISTS "Teachers can update own lesson students" ON public.lesson_students;
CREATE POLICY "Teachers can update own lesson students" ON public.lesson_students
    FOR UPDATE USING (
        auth.uid() = lesson_students.teacher_id 
        AND (
            lesson_students.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = lesson_students.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
    ) WITH CHECK (
        auth.uid() = lesson_students.teacher_id 
        AND (
            lesson_students.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = lesson_students.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
        AND EXISTS (
            SELECT 1 FROM public.lessons l 
            WHERE l.id = lesson_students.lesson_id 
              AND l.teacher_id = auth.uid()
              AND l.teacher_id = lesson_students.teacher_id 
              AND l.school_id IS NOT DISTINCT FROM lesson_students.school_id
              AND l.class_id IS NOT DISTINCT FROM lesson_students.class_id
        )
        -- Proteção rigorosa do Student e do seu Snapshot Histórico
        AND (
            (
                lesson_students.student_id IS NULL 
                AND lesson_students.student_name_snapshot = (SELECT ls.student_name_snapshot FROM public.lesson_students ls WHERE ls.id = lesson_students.id)
            )
            OR
            (
                lesson_students.student_id IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM public.students s 
                    WHERE s.id = lesson_students.student_id 
                      AND s.teacher_id = auth.uid()
                      AND s.school_id IS NOT DISTINCT FROM lesson_students.school_id
                      AND s.name = lesson_students.student_name_snapshot
                )
            )
        )
        -- Proteção rigorosa da Class e do seu Snapshot Histórico
        AND (
            (
                lesson_students.class_id IS NULL 
                AND lesson_students.class_name_snapshot IS NOT DISTINCT FROM (SELECT ls.class_name_snapshot FROM public.lesson_students ls WHERE ls.id = lesson_students.id)
            )
            OR
            (
                lesson_students.class_id IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM public.classes c 
                    WHERE c.id = lesson_students.class_id 
                      AND c.teacher_id = auth.uid()
                      AND c.school_id IS NOT DISTINCT FROM lesson_students.school_id
                      AND c.name = lesson_students.class_name_snapshot
                )
            )
        )
    );

-- DELETE
DROP POLICY IF EXISTS "Teachers can delete own lesson students" ON public.lesson_students;
CREATE POLICY "Teachers can delete own lesson students" ON public.lesson_students
    FOR DELETE USING (
        auth.uid() = lesson_students.teacher_id 
        AND (
            lesson_students.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = lesson_students.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
    );
