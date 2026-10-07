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

async function runTests() {
  const emailA = "teste.a@professorapp.com";
  const password = "Password@1234!";
  let loginA = await clientA.auth.signInWithPassword({ email: emailA, password });
  const userA = loginA.data.user.id;

  const payload = {
    teacher_id: userA,
    title: "Aula Real Criada via UI-logic",
    description: "Teste de criação imitando modal do Front",
    date: "2026-10-10",
    start_time: "08:00",
    end_time: "09:00",
    school_id: null,
    status: 'scheduled'
  }

  const { data, error } = await clientA.from("lessons").insert(payload).select().single()
  
  if (error) {
    console.error("ERRO AO CRIAR AULA REAL: ", error.message)
  } else {
    console.log("SUCESSO. Aula real criada: ", data.title)
  }
}

runTests();
