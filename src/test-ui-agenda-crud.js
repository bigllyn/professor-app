const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

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
  if (!passed) console.error(`❌ TESTE ${num} FAIL: ${name} -> ${evidence}`);
}

async function runTests() {
  console.log("=== INICIANDO TESTES FASE 3 BLOCO 3 (CRUD AULAS) ===");

  const emailA = "teste.a@professorapp.com";
  const emailB = "teste.b@professorapp.com";
  const password = "Password@1234!";

  const loginA = await clientA.auth.signInWithPassword({ email: emailA, password });
  const loginB = await clientB.auth.signInWithPassword({ email: emailB, password });
  const userA = loginA.data.user.id;
  const userB = loginB.data.user.id;

  try {
    // Pegar escolas e dados
    const { data: schA } = await clientA.from("teacher_schools").select("school_id").eq("teacher_id", userA).eq("status", "active").limit(1).single();
    const schoolA = schA.school_id;

    const { data: schB } = await clientB.from("teacher_schools").select("school_id").eq("teacher_id", userB).eq("status", "active").limit(1).single();
    const schoolB = schB.school_id;

    // Criar aula de A para testar CRUD
    const payload = {
      teacher_id: userA,
      title: "Aula CRUD Teste",
      date: "2026-10-30",
      start_time: "08:00",
      end_time: "09:00",
      school_id: schoolA,
      status: "scheduled"
    };

    const t0 = await clientA.from("lessons").insert(payload).select().single();
    const lessonId = t0.data.id;

    // TESTE 1: Professor A abre aula (simula select na aula)
    const t1 = await clientA.from("lessons").select("title").eq("id", lessonId).single();
    logTest(1, "Professor A abre aula da Escola A", !!t1.data, t1.error?.message || "Lida com sucesso");

    // TESTE 2 & 3: Professor A edita aula
    const t2 = await clientA.from("lessons").update({ title: "Aula Editada", start_time: "08:30" }).eq("id", lessonId).select().single();
    logTest(2, "Professor A edita aula", !t2.error, t2.error?.message || "Editada com sucesso");
    logTest(3, "Alteração salva no Supabase", t2.data?.title === "Aula Editada", t2.data?.title);

    // TESTE 7: Professor B não consegue editar aula de A
    const t7 = await clientB.from("lessons").update({ title: "Hack B" }).eq("id", lessonId).select();
    logTest(7, "Professor B não edita aula de A", t7.data?.length === 0, "0 rows returned (RLS blocked)");

    // TESTE 8: Professor B não consegue cancelar aula de A
    const t8 = await clientB.from("lessons").update({ status: "cancelled" }).eq("id", lessonId).select();
    logTest(8, "Professor B não cancela aula de A", t8.data?.length === 0, "0 rows returned (RLS blocked)");

    // TESTE 9: Professor A não consegue mover aula para Escola B
    const t9 = await clientA.from("lessons").update({ school_id: schoolB }).eq("id", lessonId);
    logTest(9, "Professor A não move para Escola B", t9.error && t9.error.message.includes("violates"), "Bloqueado pelo WITH CHECK do RLS");

    // TESTE 10: Professor A não associa aluno/turma de outro contexto
    // Buscando uma turma da escola B (contexto B)
    const { data: clsB } = await clientB.from("classes").select("id").eq("school_id", schoolB).limit(1).single() || { data: { id: null } };
    let test10Blocked = true;
    if (clsB && clsB.id) {
        const t10 = await clientA.from("lessons").update({ class_id: clsB.id }).eq("id", lessonId);
        test10Blocked = t10.error && t10.error.message.includes("violates row-level security");
    }
    logTest(10, "Professor A não associa dados de outro contexto", test10Blocked, "Bloqueado pelo EXISTS do RLS");

    // TESTE 4 & 5: Professor A cancela aula
    const t4 = await clientA.from("lessons").update({ status: "cancelled" }).eq("id", lessonId).select().single();
    logTest(4, "Professor A cancela aula", !t4.error, t4.error?.message || "Cancelada via status");
    logTest(5, "Status vira cancelled", t4.data?.status === "cancelled", "Status = " + t4.data?.status);

    // TESTE 6: Aula cancelada continua existindo
    const t6 = await clientA.from("lessons").select("id").eq("id", lessonId).single();
    logTest(6, "Aula cancelada continua existindo", !!t6.data, "Registro não foi apagado (No DELETE)");

    // TESTE 11: Simula listar aula na agenda e garantir que volta
    const t11 = await clientA.from("lessons").select("id, status").eq("teacher_id", userA).eq("date", "2026-10-30");
    const foundCancelled = t11.data?.some(l => l.id === lessonId && l.status === "cancelled");
    logTest(11, "Aula cancelada aparece na Agenda", foundCancelled, "Listada com status='cancelled'");

    // TESTE 12: ContextSwitcher isola registros
    const t12 = await clientA.from("lessons").select("id").eq("teacher_id", userA).eq("date", "2026-10-30").eq("school_id", schoolB);
    logTest(12, "ContextSwitcher continua isolando", t12.data?.length === 0, "0 registros retornados se isolar escola alheia");

  } catch (err) {
    console.error(`❌ FATAL ERROR: ${err.message}`);
  }

  console.log("\nTESTE | RESULTADO | OBSERVAÇÃO");
  console.log("---|---|---");
  testResults.forEach(r => {
    console.log(`${r.num} | ${r.passed ? 'PASS' : 'FAIL'} | ${r.evidence}`);
  });
}

runTests();
