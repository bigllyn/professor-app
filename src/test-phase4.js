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
  console.log("=== INICIANDO TESTES FASE 4 BLOCO 1 (LESSON_CONTENTS) ===");

  const emailA = "teste.a@professorapp.com";
  const emailB = "teste.b@professorapp.com";
  const password = "Password@1234!";

  const loginA = await clientA.auth.signInWithPassword({ email: emailA, password });
  const loginB = await clientB.auth.signInWithPassword({ email: emailB, password });
  const userA = loginA.data.user.id;
  const userB = loginB.data.user.id;

  try {
    const { data: schA } = await clientA.from("teacher_schools").select("school_id").eq("teacher_id", userA).eq("status", "active").limit(1).single();
    const schoolA = schA.school_id;
    
    const { data: schB } = await clientB.from("teacher_schools").select("school_id").eq("teacher_id", userB).eq("status", "active").limit(1).single();
    const schoolB = schB.school_id;

    // A creates lesson in School A
    const { data: lessonA } = await clientA.from("lessons").insert({
      teacher_id: userA, school_id: schoolA, title: "Lesson A", date: "2026-11-01", start_time: "10:00", end_time: "11:00"
    }).select().single();

    // A creates Private lesson
    const { data: lessonPriv } = await clientA.from("lessons").insert({
      teacher_id: userA, school_id: null, title: "Lesson Priv", date: "2026-11-01", start_time: "12:00", end_time: "13:00"
    }).select().single();

    // B creates lesson in School B
    const { data: lessonB } = await clientB.from("lessons").insert({
      teacher_id: userB, school_id: schoolB, title: "Lesson B", date: "2026-11-01", start_time: "14:00", end_time: "15:00"
    }).select().single();

    // TEST 1
    const t1 = await clientA.from("lesson_contents").insert({
      lesson_id: lessonA.id, teacher_id: userA, school_id: schoolA, title: "Content A1"
    }).select().single();
    logTest(1, "A cria conteúdo em School A", !t1.error, t1.error?.message || "Sucesso");
    const contentA1 = t1.data?.id;

    // TEST 2
    const t2 = await clientA.from("lesson_contents").insert({
      lesson_id: lessonPriv.id, teacher_id: userA, school_id: null, title: "Content Priv1"
    }).select().single();
    logTest(2, "A cria conteúdo em Private", !t2.error && t2.data.school_id === null, t2.error?.message || "Sucesso");

    // TEST 3
    const t3 = await clientA.from("lesson_contents").insert({
      lesson_id: lessonB.id, teacher_id: userA, school_id: schoolA, title: "Hack B"
    });
    logTest(3, "A cria usando lesson de B", t3.error && t3.error.message.includes("violates row-level security"), "Bloqueado pelo RLS");

    // TEST 4
    const t4 = await clientA.from("lesson_contents").insert({
      lesson_id: lessonA.id, teacher_id: userA, school_id: schoolB, title: "Cross Context Insert"
    });
    logTest(4, "A usa lesson de Escola A com school_id de Escola B", t4.error && t4.error.message.includes("violates row-level security"), "Bloqueado pelo RLS (IS NOT DISTINCT FROM)");

    // TEST 5
    const t5 = await clientA.from("lesson_contents").insert({
      lesson_id: lessonA.id, teacher_id: userB, school_id: schoolA, title: "Spoof Teacher"
    });
    logTest(5, "A insere teacher_id diferente", t5.error && t5.error.message.includes("violates row-level security"), "Bloqueado pelo RLS");

    // TEST 6
    const t6 = await clientB.from("lesson_contents").select().eq("id", contentA1);
    logTest(6, "B visualiza conteúdo de A", t6.data?.length === 0, "Retornou 0 linhas (Bloqueado RLS)");

    // TEST 7 (B update A's content)
    const t7 = await clientB.from("lesson_contents").update({ title: "Hack" }).eq("id", contentA1).select();
    logTest(7, "B atualiza conteúdo de A", t7.data?.length === 0, "Retornou 0 affected rows (Bloqueado RLS)");

    // TEST 8 (B deletes A's content)
    const t8 = await clientB.from("lesson_contents").delete().eq("id", contentA1).select();
    logTest(8, "B exclui conteúdo de A", t8.data?.length === 0, "Retornou 0 affected rows (Bloqueado RLS)");

    // TEST 9
    const t9 = await clientA.from("lesson_contents").update({ lesson_id: lessonB.id }).eq("id", contentA1);
    logTest(9, "A tenta mover conteúdo de Escola A para Escola B", t9.error && t9.error.message.includes("violates row-level security"), "Bloqueado pelo WITH CHECK do RLS");

    // TEST 10
    const t10 = await clientA.from("lesson_contents").update({ school_id: null }).eq("id", contentA1);
    logTest(10, "A altera school_id para NULL", t10.error && t10.error.message.includes("violates row-level security"), "Bloqueado pelo WITH CHECK do RLS");

    // TEST 11
    const t11 = await clientA.from("lesson_contents").update({ title: "Updated Title" }).eq("id", contentA1).select().single();
    logTest(11, "A altera title/description do próprio conteúdo", t11.data?.title === "Updated Title", "Sucesso");

    // TEST 12
    await clientA.from("lesson_contents").insert({ lesson_id: lessonA.id, teacher_id: userA, school_id: schoolA, title: "C2", sequence_order: 2 });
    await clientA.from("lesson_contents").insert({ lesson_id: lessonA.id, teacher_id: userA, school_id: schoolA, title: "C1", sequence_order: 1 });
    const t12 = await clientA.from("lesson_contents").select("title").eq("lesson_id", lessonA.id).order("sequence_order", { ascending: true });
    const isSorted = t12.data[0].title === "Updated Title" && t12.data[1].title === "C1" && t12.data[2].title === "C2";
    logTest(12, "Ordem sequence_order", isSorted, "Ordenado corretamente via index e order");

    // TEST 13
    await clientA.from("teacher_schools").update({ status: 'inactive' }).eq("school_id", schoolA).eq("teacher_id", userA);
    const t13 = await clientA.from("lesson_contents").select("id").eq("school_id", schoolA);
    logTest(13, "A acessa conteúdo de escola inativa", t13.data?.length === 0, "Retornou 0 linhas (Bloqueado RLS)");
    await clientA.from("teacher_schools").update({ status: 'active' }).eq("school_id", schoolA).eq("teacher_id", userA);

    // TEST 14
    await clientA.from("lessons").delete().eq("id", lessonA.id);
    const t14 = await clientA.from("lesson_contents").select("id").eq("id", contentA1);
    logTest(14, "Excluir lesson exclui contents (CASCADE)", t14.data?.length === 0, "Deletado em cascata");

    // TEST 15
    const t15 = await clientA.from("lesson_contents").select("id").eq("id", t2.data.id);
    logTest(15, "Estrutura para aula particular", t15.data?.length > 0, "school_id = NULL mantido seguro");

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
