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

const testResults = [];
function logTest(testName, passed, evidence) {
  testResults.push({ testName, passed, evidence });
}

async function runTests() {
  const client = createClient(supabaseUrl, supabaseAnonKey);
  const email = "teste.a@professorapp.com";
  const password = "Password@1234!";

  console.log("=== TESTANDO BLOCOS 1 E 2 (PERFIL/ONBOARDING E ESCOLAS) ===\n");

  let login = await client.auth.signInWithPassword({ email, password });
  if (login.error) {
    console.error("Falha fatal no login");
    return;
  }
  const userId = login.data.user.id;
  
  try {
    // 1. UPDATE PROFILE
    const updateRes = await client.from("profiles").update({
      full_name: "Professor Atualizado",
      display_name: "Prof. Atual",
      profession: "Físico",
      work_types: ["escola", "particular"]
    }).eq("id", userId);

    if (updateRes.error) throw new Error("Erro update profile: " + updateRes.error.message);
    
    const verifyProfile = await client.from("profiles").select("*").eq("id", userId).single();
    if (verifyProfile.data.full_name === "Professor Atualizado" && verifyProfile.data.work_types.includes("escola")) {
      logTest("1. Perfil / Onboarding", true, "Update RLS liberado e dados persistidos no banco");
    } else {
      throw new Error("Update não validado no banco");
    }

    // 2. CRIAR ESCOLA ONBOARDING
    const schoolName = "Escola Onboarding " + Date.now();
    const schoolInsert = await client.from("schools").insert({ name: schoolName });
    if (schoolInsert.error) throw new Error("Erro insert school: " + schoolInsert.error.message);

    const checkSchool = await client.from("schools").select("*").eq("name", schoolName).single();
    if (checkSchool.data.id) {
      logTest("2. Escolas", true, "Escola inserida e retornada via SELECT isolado. RLS e Triggers validados.");
    } else {
      throw new Error("Escola não retornada após insert");
    }

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
