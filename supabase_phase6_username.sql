-- Migration: Adicionar suporte a username e criar função de resolução
-- Arquivo: scratch/professor/supabase_phase6_username.sql

BEGIN;

-- 1. Adicionar campo username
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- 2. Função e Trigger para normalizar o username para lowercase
CREATE OR REPLACE FUNCTION public.normalize_username()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.username IS NOT NULL THEN
        NEW.username := LOWER(TRIM(NEW.username));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_normalize_username ON public.profiles;
CREATE TRIGGER trigger_normalize_username
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.normalize_username();

-- 3. Função RPC SECURITY DEFINER para resolver username para e-mail
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT AS $$
DECLARE
    v_email TEXT;
BEGIN
    SELECT u.email INTO v_email
    FROM public.profiles p
    JOIN auth.users u ON p.id = u.id
    WHERE p.username = LOWER(TRIM(p_username))
    LIMIT 1;

    RETURN v_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. Ajuste estrito de privilégios da RPC
REVOKE ALL ON FUNCTION public.get_email_by_username(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO anon, authenticated;

-- 5. Definir a conta master ('bigllyn') associada ao e-mail existente
UPDATE public.profiles
SET username = 'bigllyn'
WHERE id = (
    SELECT id 
    FROM auth.users 
    WHERE email = 'benignoxavier@gmail.com' 
    LIMIT 1
);

COMMIT;
