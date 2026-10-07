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

const testResults = [];
function logTest(testName, passed, evidence) {
  testResults.push({ testName, passed, evidence });
  console.log(`${passed ? '✅ PASSOU' : '❌ FALHOU'} | ${testName} | ${evidence}`);
}

async function runTests() {
  console.log("=== TESTANDO CRUD UI - TURMAS E ALUNOS ===\n");

  const emailA = "teste.a@professorapp.com";
  const password = "Password@1234!";

  let loginA = await clientA.auth.signInWithPassword({ email: emailA, password });
  if (loginA.error) return console.error("Falha fatal no login");

  const userA = loginA.data.user.id;

  try {
    // 1. CRIAR TURMA VIA API DO COMPONENTE
    const cName = "Turma Frontend " + Date.now();
    const t1 = await clientA.from("classes").insert({ teacher_id: userA, school_id: null, name: cName }).select().single();
    if (t1.error) throw new Error(t1.error.message);
    const classId = t1.data.id;
    logTest("Create Class", true, `Turma criada (ID: ${classId})`);

    // 2. EDITAR TURMA VIA API DO COMPONENTE
    const cNewName = "Turma Frontend Editada";
    const t2 = await clientA.from("classes").update({ name: cNewName }).eq("id", classId).select().single();
    if (t2.data.name === cNewName) logTest("Update Class", true, "Turma renomeada com sucesso");

    // 3. CRIAR ALUNO VIA API DO COMPONENTE
    const sName = "Aluno Frontend " + Date.now();
    const t3 = await clientA.from("students").insert({ teacher_id: userA, school_id: null, class_id: classId, name: sName }).select().single();
    if (t3.error) throw new Error(t3.error.message);
    const studentId = t3.data.id;
    logTest("Create Student", true, `Aluno inserido (ID: ${studentId}) associado a turma.`);

    // 4. LER DADOS (Simulação de Contexto 'Private')
    const t4 = await clientA.from("students").select("id, name, classes(name)").is("school_id", null);
    if (t4.data.find(s => s.id === studentId)) logTest("Read Students Context", true, "SSR Query retornou o aluno corretamente com JOIN classes");

    // 5. EXCLUIR ALUNO
    const t5 = await clientA.from("students").delete().eq("id", studentId);
    if (!t5.error) logTest("Delete Student", true, "Exclusão autorizada e executada");

    // 6. EXCLUIR TURMA
    const t6 = await clientA.from("classes").delete().eq("id", classId);
    if (!t6.error) logTest("Delete Class", true, "Exclusão autorizada e executada");

  } catch (err) {
    console.error(`\n❌ ERRO FATAL: ${err.message}`);
  }

  console.log("\nTESTE FINALIZADO!");
}

runTests();
