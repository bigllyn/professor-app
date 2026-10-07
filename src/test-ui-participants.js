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
  console.log("=== INICIANDO TESTES DE PARTICIPANTES ===");

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

    // Criar turma
    const { data: clazz } = await clientA.from("classes").insert({
      name: "Turma de Participantes", teacher_id: userA, school_id: schoolA, year: 2026
    }).select().single();

    // Criar 3 alunos
    const stList = [
      { name: "Partic 1", email: "p1@a", class_id: clazz.id, teacher_id: userA, school_id: schoolA },
      { name: "Partic 2", email: "p2@a", class_id: clazz.id, teacher_id: userA, school_id: schoolA },
      { name: "Partic 3", email: "p3@a", class_id: clazz.id, teacher_id: userA, school_id: schoolA }
    ];
    const { data: studentsData } = await clientA.from("students").insert(stList).select();

    // Criar Aula A com class_id (Simulando API Backend)
    const { data: lessonA } = await clientA.from("lessons").insert({
      teacher_id: userA, school_id: schoolA, class_id: clazz.id, title: "Aula c/ 3 part", date: "2026-11-20", start_time: "10:00", end_time: "11:00"
    }).select().single();

    // Inserir os 3
    const lsPayload = studentsData.map(s => ({
      lesson_id: lessonA.id,
      student_id: s.id,
      teacher_id: userA,
      school_id: schoolA,
      class_id: clazz.id,
      student_name_snapshot: s.name,
      class_name_snapshot: clazz.name
    }));
    await clientA.from("lesson_students").insert(lsPayload);

    // Teste A: 3 alunos criados
    const tA = await clientA.from("lesson_students").select().eq("lesson_id", lessonA.id);
    logTest("A", "Criar aula de turma com 3 alunos", tA.data?.length === 3, `Count = ${tA.data?.length}`);

    // Teste C: Remover 1 participante (API request)
    const toRemove = tA.data[0];
    await clientA.from("lesson_students").delete().eq("id", toRemove.id);
    const tC = await clientA.from("students").select().eq("id", toRemove.student_id).single();
    logTest("C", "Remover 1 participante → aluno continua em students", !!tC.data, `Student existe: ${tC.data.name}`);

    // Teste D: Adicionar novamente
    const { data: reAdded } = await clientA.from("lesson_students").insert({
      lesson_id: lessonA.id,
      student_id: toRemove.student_id,
      teacher_id: userA,
      school_id: schoolA,
      class_id: clazz.id,
      student_name_snapshot: toRemove.student_name_snapshot,
      class_name_snapshot: toRemove.class_name_snapshot
    }).select();
    logTest("D", "Adicionar novamente", !!reAdded, `Sucesso inserção`);

    // Teste E: Criar aula particular
    const { data: privStudent } = await clientA.from("students").insert({
      name: "Aluno Priv", email: "priv@a", teacher_id: userA, school_id: null
    }).select().single();

    const { data: lessonPriv, error: errPriv } = await clientA.from("lessons").insert({
      teacher_id: userA, school_id: null, student_id: privStudent.id, title: "Privada part", date: "2026-11-20", start_time: "12:00", end_time: "13:00"
    }).select().single();
    if (errPriv) throw new Error("Erro insert lessonPriv: " + errPriv.message);

    await clientA.from("lesson_students").insert({
       lesson_id: lessonPriv.id,
       student_id: privStudent.id,
       teacher_id: userA,
       school_id: null,
       class_id: null,
       student_name_snapshot: privStudent.name,
       class_name_snapshot: null
    });
    const tE = await clientA.from("lesson_students").select().eq("lesson_id", lessonPriv.id);
    logTest("E", "Criar aula particular → participante", tE.data?.length === 1 && tE.data[0].school_id === null, "Isolamento particular ok");

    // Teste F: Professor B
    const tF = await clientB.from("lesson_students").select().eq("lesson_id", lessonA.id);
    logTest("F", "Professor B não consegue acessar", tF.data?.length === 0, "Length = 0");

    // Cleanup
    await clientA.from("lessons").delete().eq("id", lessonA.id);
    await clientA.from("lessons").delete().eq("id", lessonPriv.id);
    await clientA.from("students").delete().eq("class_id", clazz.id);
    await clientA.from("students").delete().eq("id", privStudent.id);
    await clientA.from("classes").delete().eq("id", clazz.id);

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
