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

  try {
    // Pegar a primeira escola do Professor A
    const { data: sch } = await clientA.from("teacher_schools").select("school_id").eq("teacher_id", userA).eq("status", "active").limit(1).single();
    const schoolId = sch.school_id;

    // Pegar (ou criar) turma, disciplina e aluno nesta escola
    const { data: cls } = await clientA.from("classes").select("id").eq("school_id", schoolId).limit(1).single();
    const { data: sub } = await clientA.from("subjects").select("id").eq("school_id", schoolId).limit(1).single() || { data: { id: null } };
    const { data: std } = await clientA.from("students").select("id").eq("school_id", schoolId).limit(1).single() || { data: { id: null } };

    // TESTE 1: UI Payload Escola
    const payload1 = {
      teacher_id: userA,
      title: "UI Test Lesson School",
      date: "2026-10-20",
      start_time: "10:00",
      end_time: "11:00",
      school_id: schoolId,
      class_id: cls?.id || null,
      subject_id: sub?.id || null,
      student_id: std?.id || null,
      status: "scheduled"
    };

    const t1 = await clientA.from("lessons").insert(payload1).select().single();
    if (t1.error) throw new Error("Test 1 Fail: " + t1.error.message);
    
    // Verificações
    const v1 = await clientA.from("lessons").select("teacher_id, school_id, class_id").eq("id", t1.data.id).single();
    console.log("TESTE 1 PASSOU. Aula gravada:", v1.data);

    // TESTE 2: UI Payload Particular
    const { data: clsP } = await clientA.from("classes").select("id").is("school_id", null).limit(1).single() || { data: { id: null } };
    
    const payload2 = {
      teacher_id: userA,
      title: "UI Test Lesson Private",
      date: "2026-10-21",
      start_time: "15:00",
      end_time: "16:00",
      school_id: null,
      class_id: clsP?.id || null,
      status: "scheduled"
    };

    const t2 = await clientA.from("lessons").insert(payload2).select().single();
    if (t2.error) throw new Error("Test 2 Fail: " + t2.error.message);

    const v2 = await clientA.from("lessons").select("teacher_id, school_id").eq("id", t2.data.id).single();
    console.log("TESTE 2 PASSOU. Aula gravada:", v2.data);

  } catch (err) {
    console.error("FALHA: ", err.message);
  }
}

runTests();
