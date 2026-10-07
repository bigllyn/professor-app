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
  if (!passed) console.error(`❌ TESTE FAIL: ${name} -> ${evidence}`);
}

async function runTests() {
  console.log("=== INICIANDO TESTES HISTÓRICO PEDAGÓGICO ===");

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

    // A creates Private lesson
    const { data: lessonPriv } = await clientA.from("lessons").insert({
      teacher_id: userA, school_id: null, title: "Lesson Historico Priv", date: "2026-10-15", start_time: "12:00", end_time: "13:00"
    }).select().single();

    // A creates lesson contents
    const { data: cont1 } = await clientA.from("lesson_contents").insert({
      lesson_id: lessonPriv.id, teacher_id: userA, school_id: null, title: "Fração", sequence_order: 0
    }).select().single();

    // Test 1: Fetch history for all context
    const t1 = await clientA.from("lessons").select(`
      id, school_id,
      lesson_contents(title)
    `).eq("teacher_id", userA);

    logTest(1, "Teste histórico com dados reais (retorna aulas)", t1.data?.length > 0, `Lessons fetched: ${t1.data?.length}`);

    // Test 2: Context isolation
    const t2 = await clientA.from("lessons").select().eq("teacher_id", userA).eq("school_id", schoolA);
    const privateFound = t2.data?.find(l => l.id === lessonPriv.id);
    logTest(2, "Teste troca de contexto (Escola A não deve ver Aula Particular)", !privateFound, "Particular escondida no filtro da escola");

    // Test 3: Context isolation private
    const t3 = await clientA.from("lessons").select().eq("teacher_id", userA).is("school_id", null);
    const privateFound2 = t3.data?.find(l => l.id === lessonPriv.id);
    logTest(3, "Teste troca de contexto (Aulas particulares retorna)", !!privateFound2, "Particular visível no filtro particular");

    // Test 4: Professor B tries to see A's history
    const t4 = await clientB.from("lessons").select().eq("teacher_id", userA);
    logTest(4, "Nunca mostrar dados de outro professor", t4.data?.length === 0, "Professor B enxerga 0 aulas de A");

    // Test 5: Empty state (Teacher B has no lessons here)
    const t5 = await clientB.from("lessons").select().eq("teacher_id", userB);
    logTest(5, "Teste professor sem histórico", t5.data?.length === 0 || t5.data === null, "Lista vazia ou nula");

    // Clean up
    await clientA.from("lessons").delete().eq("id", lessonPriv.id);

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
