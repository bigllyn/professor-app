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
const client = createClient(supabaseUrl, supabaseAnonKey);

const testResults = [];
function logTest(testName, passed, evidence) {
  testResults.push({ testName, passed, evidence });
}

async function runTests() {
  const email = "teste.a@professorapp.com";
  const password = "Password@1234!";

  console.log("=== TESTANDO BLOCO 5 (DISCIPLINAS) ===\n");

  let login = await client.auth.signInWithPassword({ email, password });
  if (login.error) return console.error("Falha fatal no login");
  const userId = login.data.user.id;
  
  try {
    const subjectName = "Filosofia " + Date.now();
    const { data: newSubj, error: insErr } = await client.from("subjects").insert({ teacher_id: userId, name: subjectName, school_id: null }).select().single();
    if (insErr) throw new Error("Erro insert subject: " + insErr.message);

    logTest("5. Disciplinas: Insert", true, `Disciplina criada com ID ${newSubj.id}`);

    const { error: delErr } = await client.from("subjects").delete().eq("id", newSubj.id);
    if (delErr) throw new Error("Erro delete subject: " + delErr.message);

    logTest("5. Disciplinas: Delete", true, `Disciplina ID ${newSubj.id} deletada com sucesso`);

  } catch (err) {
    console.error(`\n❌ FALHOU: ${err.message}`);
  }

  console.log("\nTESTE | RESULTADO | EVIDÊNCIA");
  console.log("---|---|---");
  testResults.forEach(r => {
    console.log(`${r.testName.padEnd(45, ' ')} | ${r.passed ? '✅ PASSOU' : '❌ FALHOU'} | ${r.evidence}`);
  });
}

runTests();
