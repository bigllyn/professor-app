-- Fase 2: Tabelas adicionais (Turmas e Alunos) - AUDITADO (V3: Qualificação explícita e isolamento de contexto de classe)

-- 1. Função genérica de atualização do updated_at (CREATE OR REPLACE é seguro para reexecução)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC;

-- ==========================================
-- TABELA: CLASSES (TURMAS)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE, -- NULL = Aulas Particulares
    subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
    grade_id UUID REFERENCES public.grades(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    year TEXT DEFAULT to_char(CURRENT_DATE, 'YYYY'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices de performance para Classes
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON public.classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_school_id ON public.classes(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_subject_id ON public.classes(subject_id);

-- Trigger de updated_at para Classes seguro para reexecução
DROP TRIGGER IF EXISTS on_classes_updated ON public.classes;
CREATE TRIGGER on_classes_updated
    BEFORE UPDATE ON public.classes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS para Classes
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view own classes" ON public.classes;
CREATE POLICY "Teachers can view own classes" ON public.classes
    FOR SELECT USING (
        auth.uid() = classes.teacher_id 
        AND (
            classes.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = classes.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
    );

DROP POLICY IF EXISTS "Teachers can insert own classes" ON public.classes;
CREATE POLICY "Teachers can insert own classes" ON public.classes
    FOR INSERT WITH CHECK (
        auth.uid() = classes.teacher_id 
        AND (
            classes.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = classes.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
    );

DROP POLICY IF EXISTS "Teachers can update own classes" ON public.classes;
CREATE POLICY "Teachers can update own classes" ON public.classes
    FOR UPDATE USING (
        auth.uid() = classes.teacher_id 
        AND (
            classes.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = classes.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
    ) WITH CHECK (
        auth.uid() = classes.teacher_id 
        AND (
            classes.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = classes.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
    );

DROP POLICY IF EXISTS "Teachers can delete own classes" ON public.classes;
CREATE POLICY "Teachers can delete own classes" ON public.classes
    FOR DELETE USING (
        auth.uid() = classes.teacher_id 
        AND (
            classes.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = classes.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
    );

-- ==========================================
-- TABELA: STUDENTS (ALUNOS)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.students (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE, -- NULL = Aulas Particulares
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices de performance para Students
CREATE INDEX IF NOT EXISTS idx_students_teacher_id ON public.students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_school_id ON public.students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON public.students(class_id);

-- Trigger de updated_at para Students seguro para reexecução
DROP TRIGGER IF EXISTS on_students_updated ON public.students;
CREATE TRIGGER on_students_updated
    BEFORE UPDATE ON public.students
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS para Students
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view own students" ON public.students;
CREATE POLICY "Teachers can view own students" ON public.students
    FOR SELECT USING (
        auth.uid() = students.teacher_id 
        AND (
            students.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = students.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
    );

DROP POLICY IF EXISTS "Teachers can insert own students" ON public.students;
CREATE POLICY "Teachers can insert own students" ON public.students
    FOR INSERT WITH CHECK (
        auth.uid() = students.teacher_id 
        AND (
            students.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = students.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
        AND (
            students.class_id IS NULL OR 
            EXISTS (
                SELECT 1 FROM public.classes c 
                WHERE c.id = students.class_id 
                AND c.teacher_id = auth.uid() 
                AND c.school_id IS NOT DISTINCT FROM students.school_id
            )
        )
    );

DROP POLICY IF EXISTS "Teachers can update own students" ON public.students;
CREATE POLICY "Teachers can update own students" ON public.students
    FOR UPDATE USING (
        auth.uid() = students.teacher_id 
        AND (
            students.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = students.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
    ) WITH CHECK (
        auth.uid() = students.teacher_id 
        AND (
            students.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = students.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
        AND (
            students.class_id IS NULL OR 
            EXISTS (
                SELECT 1 FROM public.classes c 
                WHERE c.id = students.class_id 
                AND c.teacher_id = auth.uid() 
                AND c.school_id IS NOT DISTINCT FROM students.school_id
            )
        )
    );

DROP POLICY IF EXISTS "Teachers can delete own students" ON public.students;
CREATE POLICY "Teachers can delete own students" ON public.students
    FOR DELETE USING (
        auth.uid() = students.teacher_id 
        AND (
            students.school_id IS NULL OR 
            EXISTS (SELECT 1 FROM public.teacher_schools ts WHERE ts.school_id = students.school_id AND ts.teacher_id = auth.uid() AND ts.status = 'active')
        )
    );
