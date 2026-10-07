const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// 1. Carrega as variáveis de ambiente
const envContent = fs.readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  if (line.includes('=')) {
    const [k, ...v] = line.split('=');
    process.env[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const clientA = createClient(supabaseUrl, supabaseAnonKey);
const clientB = createClient(supabaseUrl, supabaseAnonKey);

const testResults = [];

function logTest(num, name, passed, evidence) {
  testResults.push({ num, name, passed, evidence });
}

async function runTests() {
  console.log("=== INICIANDO TESTES FASE 3 (AULAS / AGENDA) ===");

  const emailA = "teste.a@professorapp.com";
  const emailB = "teste.b@professorapp.com";
  const password = "Password@1234!";

  const loginA = await clientA.auth.signInWithPassword({ email: emailA, password });
  const loginB = await clientB.auth.signInWithPassword({ email: emailB, password });

  if (loginA.error || loginB.error) {
    return console.error("Falha no login dos usuários de teste.");
  }

  const userA = loginA.data.user.id;
  const userB = loginB.data.user.id;

  try {
    // SETUP DE DADOS
    const sAName = "EscA " + Date.now();
    await clientA.from("schools").insert({ name: sAName });
    const { data: fetchSA } = await clientA.from("schools").select("id").eq("name", sAName).single();
    const schoolA = fetchSA.id;

    const sBName = "EscB " + Date.now();
    await clientB.from("schools").insert({ name: sBName });
    const { data: fetchSB } = await clientB.from("schools").select("id").eq("name", sBName).single();
    const schoolB = fetchSB.id;

    const sA2Name = "EscA2 " + Date.now();
    await clientA.from("schools").insert({ name: sA2Name });
    const { data: fetchSA2 } = await clientA.from("schools").select("id").eq("name", sA2Name).single();
    const schoolA2 = fetchSA2.id;

    // Criar Turmas, Disciplinas e Alunos para A e B
    await clientB.from("classes").insert({ teacher_id: userB, school_id: schoolB, name: "Turma B" });
    const { data: classB } = await clientB.from("classes").select("id").eq("name", "Turma B").order("created_at", {ascending: false}).limit(1).single();

    await clientA.from("subjects").insert({ teacher_id: userA, school_id: null, name: "Subj Priv A" });
    const { data: subjPrivA } = await clientA.from("subjects").select("id").eq("name", "Subj Priv A").order("created_at", {ascending: false}).limit(1).single();

    await clientA.from("students").insert({ teacher_id: userA, school_id: schoolA, name: "Student Esc A" });
    const { data: studentA } = await clientA.from("students").select("id").eq("name", "Student Esc A").order("created_at", {ascending: false}).limit(1).single();

    const baseLesson = { title: "Test Lesson", date: "2025-01-01", start_time: "10:00", end_time: "11:00", teacher_id: userA };

    // TESTE 1: A cria aula na Escola A
    const t1 = await clientA.from("lessons").insert({ ...baseLesson, school_id: schoolA });
    const { data: lessonA } = await clientA.from("lessons").select("id").eq("school_id", schoolA).order("created_at", {ascending: false}).limit(1).single();
    if (!t1.error && lessonA) logTest(1, "A cria aula na Escola A", true, "Sucesso");
    else logTest(1, "A cria aula na Escola A", false, t1.error?.message);

    // TESTE 2: A cria aula particular
    const t2 = await clientA.from("lessons").insert({ ...baseLesson, school_id: null });
    if (!t2.error) logTest(2, "A cria aula particular", true, "Sucesso");
    else logTest(2, "A cria aula particular", false, t2.error.message);

    // TESTE 3: A tenta usar turma de B
    const t3 = await clientA.from("lessons").insert({ ...baseLesson, school_id: schoolA, class_id: classB.id });
    if (t3.error && t3.error.message.includes("violates row-level security")) logTest(3, "A tenta usar turma B", true, "Bloqueado RLS");
    else logTest(3, "A tenta usar turma B", false, "Falhou bloqueio");

    // TESTE 4: A tenta usar disciplina de outro contexto
    const t4 = await clientA.from("lessons").insert({ ...baseLesson, school_id: schoolA, subject_id: subjPrivA.id });
    if (t4.error && t4.error.message.includes("violates row-level security")) logTest(4, "A usa disciplina de outro contexto", true, "Bloqueado RLS");
    else logTest(4, "A usa disciplina de outro contexto", false, "Falhou bloqueio");

    // TESTE 5: A tenta usar aluno de outro contexto (Aula particular com aluno da Escola A)
    const t5 = await clientA.from("lessons").insert({ ...baseLesson, school_id: null, student_id: studentA.id });
    if (t5.error && t5.error.message.includes("violates row-level security")) logTest(5, "A usa aluno de outro contexto", true, "Bloqueado RLS");
    else logTest(5, "A usa aluno de outro contexto", false, "Falhou bloqueio");

    // TESTE 6: B tenta ler aula de A
    const t6 = await clientB.from("lessons").select("id").eq("id", lessonA.id);
    if (t6.data && t6.data.length === 0) logTest(6, "B tenta ler aula de A", true, "Retornou 0 linhas");
    else logTest(6, "B tenta ler aula de A", false, "Leu indevidamente");

    // TESTE 7: B tenta atualizar aula de A
    const t7 = await clientB.from("lessons").update({ title: "Hacked" }).eq("id", lessonA.id);
    const verifyT7 = await clientA.from("lessons").select("title").eq("id", lessonA.id).single();
    if (t7.error || verifyT7.data.title !== "Hacked") logTest(7, "B tenta atualizar aula de A", true, "Bloqueado / 0 rows affected");
    else logTest(7, "B tenta atualizar aula de A", false, "Conseguiu atualizar");

    // TESTE 8: Professor inativo tenta criar aula
    await clientA.from("teacher_schools").update({ status: 'inactive' }).eq("school_id", schoolA2).eq("teacher_id", userA);
    const t8 = await clientA.from("lessons").insert({ ...baseLesson, school_id: schoolA2 });
    if (t8.error && t8.error.message.includes("violates row-level security")) logTest(8, "Professor inativo cria aula", true, "Bloqueado RLS");
    else logTest(8, "Professor inativo cria aula", false, "Falhou bloqueio");

    // TESTE 9: end_time <= start_time
    const t9 = await clientA.from("lessons").insert({ ...baseLesson, school_id: schoolA, start_time: "11:00", end_time: "10:00" });
    if (t9.error && t9.error.message.includes("check_time_order")) logTest(9, "Aula com horário invertido", true, "Bloqueado CHECK constraint");
    else logTest(9, "Aula com horário invertido", false, "Falhou bloqueio");

    // TESTE 10: Alterar escola de A para B
    const t10 = await clientA.from("lessons").update({ school_id: schoolB }).eq("id", lessonA.id);
    const verifyT10 = await clientA.from("lessons").select("school_id").eq("id", lessonA.id).single();
    if ((t10.error && t10.error.message.includes("violates")) || verifyT10.data.school_id === schoolA) logTest(10, "Alterar escola de A para B", true, "Bloqueado RLS / 0 rows");
    else logTest(10, "Alterar escola de A para B", false, "Permitiu update");

    // TESTE 11: Verificar status permitidos
    const ts1 = await clientA.from("lessons").insert({ ...baseLesson, school_id: null, title: "S1", status: "scheduled" });
    const ts2 = await clientA.from("lessons").insert({ ...baseLesson, school_id: null, title: "S2", status: "completed" });
    const ts3 = await clientA.from("lessons").insert({ ...baseLesson, school_id: null, title: "S3", status: "cancelled" });
    if (!ts1.error && !ts2.error && !ts3.error) logTest(11, "Status permitidos", true, "Aceitos");
    else logTest(11, "Status permitidos", false, "Erro em algum status");

    // TESTE 12: B tenta excluir aula de A (Verificar isolamento Delete)
    const t12 = await clientB.from("lessons").delete().eq("id", lessonA.id);
    const verifyT12 = await clientA.from("lessons").select("id").eq("id", lessonA.id);
    if ((t12.error && t12.error.message.includes("violates")) || verifyT12.data.length > 0) logTest(12, "Isolamento DELETE", true, "Bloqueado / 0 rows deletadas");
    else logTest(12, "Isolamento DELETE", false, "Aula excluída indevidamente");

  } catch (err) {
    console.error(`❌ FATAL ERROR: ${err.message}`);
  }

  console.log("\nTESTE | RESULTADO");
  console.log("---|---");
  testResults.forEach(r => {
    console.log(`${r.num} | ${r.passed ? 'PASS' : 'FAIL'}`);
  });

  // Mostra logs detalhados apenas das falhas se houver
  const failures = testResults.filter(r => !r.passed);
  if (failures.length > 0) {
    console.log("\nDETALHES DAS FALHAS:");
    failures.forEach(f => {
      console.log(`Teste ${f.num}: ${f.evidence}`);
    });
  }
}

runTests();
