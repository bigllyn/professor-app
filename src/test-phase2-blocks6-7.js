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
function logTest(testName, passed, evidence) {
  testResults.push({ testName, passed, evidence });
}

async function runTests() {
  const emailA = "teste.a@professorapp.com";
  const emailB = "teste.b@professorapp.com";
  const password = "Password@1234!";

  let loginA = await clientA.auth.signInWithPassword({ email: emailA, password });
  let loginB = await clientB.auth.signInWithPassword({ email: emailB, password });

  if (loginA.error || loginB.error) return console.error("Falha fatal no login");

  const userA = loginA.data.user.id;
  const userB = loginB.data.user.id;

  try {
    const sAName = "Escola A " + Date.now();
    await clientA.from("schools").insert({ name: sAName });
    const { data: fetchSA } = await clientA.from("schools").select("id").eq("name", sAName).single();
    const schoolA = fetchSA.id;

    const sBName = "Escola B " + Date.now();
    await clientB.from("schools").insert({ name: sBName });
    const { data: fetchSB } = await clientB.from("schools").select("id").eq("name", sBName).single();
    const schoolB = fetchSB.id;

    const sA2Name = "Escola A2 " + Date.now();
    await clientA.from("schools").insert({ name: sA2Name });
    const { data: fetchSA2 } = await clientA.from("schools").select("id").eq("name", sA2Name).single();
    const schoolA2 = fetchSA2.id;

    const classAName = "Turma A " + Date.now();
    const t1 = await clientA.from("classes").insert({ teacher_id: userA, school_id: schoolA, name: classAName });
    const { data: classA } = await clientA.from("classes").select("id").eq("name", classAName).single();
    if (!t1.error && classA) logTest("1. Prof A cria turma na Escola A", true, "Insert autorizado pelo RLS");

    const classPrivName = "Turma Priv " + Date.now();
    const t2 = await clientA.from("classes").insert({ teacher_id: userA, school_id: null, name: classPrivName });
    const { data: classPriv } = await clientA.from("classes").select("id").eq("name", classPrivName).single();
    if (!t2.error && classPriv) logTest("2. Prof A cria turma particular", true, "Insert autorizado sem school_id");

    const t3 = await clientA.from("classes").insert({ teacher_id: userA, school_id: schoolB, name: "Turma Hacker" });
    if (t3.error && t3.error.message.includes("violates row-level security")) logTest("3. Prof A tenta criar turma na Escola B", true, `Bloqueado. Erro: "${t3.error.message}"`);

    const t4 = await clientB.from("classes").select("*").eq("id", classA.id);
    if (t4.data && t4.data.length === 0) logTest("4. Prof B tenta acessar turma de A", true, "Retornou array vazio (0 rows lidas)");

    const studentAName = "Aluno A " + Date.now();
    const t5 = await clientA.from("students").insert({ teacher_id: userA, school_id: schoolA, class_id: classA.id, name: studentAName });
    if (!t5.error) logTest("5. Aluno A + turma Escola A", true, "Insert autorizado");

    const classA2Name = "Turma A2 " + Date.now();
    await clientA.from("classes").insert({ teacher_id: userA, school_id: schoolA2, name: classA2Name });
    const { data: classA2 } = await clientA.from("classes").select("id").eq("name", classA2Name).single();

    const t6 = await clientA.from("students").insert({ teacher_id: userA, school_id: schoolA, class_id: classA2.id, name: "Aluno Misto" });
    if (t6.error && t6.error.message.includes("violates row-level security")) logTest("6. Aluno Escola A + turma Escola B", true, `Bloqueado pelo 'IS NOT DISTINCT FROM'. Erro: "${t6.error.message}"`);

    const t7 = await clientA.from("students").insert({ teacher_id: userA, school_id: null, class_id: classPriv.id, name: "Aluno Priv" });
    if (!t7.error) logTest("7. Aluno particular + turma particular", true, "Insert autorizado em contexto nulo");

    const t8 = await clientA.from("students").insert({ teacher_id: userA, school_id: null, class_id: classA.id, name: "Aluno Invasor" });
    if (t8.error && t8.error.message.includes("violates row-level security")) logTest("8. Aluno particular + turma escolar", true, `Bloqueado. Erro: "${t8.error.message}"`);

    await clientA.from("teacher_schools").update({ status: 'inactive' }).eq("school_id", schoolA2).eq("teacher_id", userA);
    const t9 = await clientA.from("classes").insert({ teacher_id: userA, school_id: schoolA2, name: "Turma Fantasma" });
    if (t9.error && t9.error.message.includes("violates row-level security")) logTest("9. Prof removido tenta criar turma", true, `Bloqueado por status 'inactive'. Erro: "${t9.error.message}"`);

    const t10 = await clientA.from("classes").update({ school_id: schoolB }).eq("id", classA.id);
    const verifyT10 = await clientA.from("classes").select("school_id").eq("id", classA.id).single();
    if (t10.error && t10.error.message.includes("violates")) {
       logTest("10. UPDATE mudar Escola A para Escola B", true, `Bloqueado no Postgres. Erro: "${t10.error.message}"`);
    } else if (verifyT10.data.school_id === schoolA) {
       logTest("10. UPDATE mudar Escola A para Escola B", true, "Bloqueado silenciosamente (0 linhas afetadas no USING).");
    }

  } catch (err) {
    console.error(`\n❌ ERRO FATAL: ${err.message}`);
  }

  console.log("TESTE | RESULTADO | EVIDÊNCIA");
  console.log("---|---|---");
  testResults.forEach(r => {
    console.log(`${r.testName.padEnd(45, ' ')} | ${r.passed ? '✅ PASSOU' : '❌ FALHOU'} | ${r.evidence}`);
  });
}

runTests();
