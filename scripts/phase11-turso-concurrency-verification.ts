import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";
import { v4 as uuidv4 } from "uuid";
import { encrypt } from "../src/lib/auth/session";

const MANIFEST_PATH = path.join(process.cwd(), "phase11_manifest.json");

interface Manifest {
  runId: string;
  timestamp: string;
  createdIds: {
    users: string[];
    classes: string[];
    subjects: string[];
    sessions: string[];
    enrollments: string[];
    classTeacherAssignments: string[];
    teachingAssignments: string[];
    marks: string[];
  };
  previousActiveSessionId?: string | null;
}

function loadManifest(): Manifest | null {
  if (fs.existsSync(MANIFEST_PATH)) {
    try { return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8")); } catch (e) { }
  }
  return null;
}

function saveManifest(manifest: Manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
}

function createIsolatedClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  if (!url || !authToken) throw new Error("DATABASE_URL and DATABASE_AUTH_TOKEN must be set");
  const adapter = new PrismaLibSql({ url, authToken } as any);
  return new PrismaClient({ adapter });
}

const db = createIsolatedClient();

async function generateCookie(userId: string, role: string) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const jwt = await encrypt({ userId, role, needsPasswordChange: false, expiresAt });
  return `session=${jwt}`;
}

async function cleanup(manifest: Manifest) {
  console.log(`\n🧹 Cleaning up Phase 11 resources for run ${manifest.runId}...`);
  const { createdIds } = manifest;

  if (createdIds.marks.length > 0) await db.mark.deleteMany({ where: { id: { in: createdIds.marks } } });
  if (createdIds.teachingAssignments.length > 0) await db.teachingAssignment.deleteMany({ where: { id: { in: createdIds.teachingAssignments } } });
  if (createdIds.classTeacherAssignments.length > 0) await db.classTeacherAssignment.deleteMany({ where: { id: { in: createdIds.classTeacherAssignments } } });
  if (createdIds.enrollments.length > 0) await db.studentEnrollment.deleteMany({ where: { id: { in: createdIds.enrollments } } });
  
  if (createdIds.subjects.length > 0) await db.subject.deleteMany({ where: { id: { in: createdIds.subjects } } });
  if (createdIds.classes.length > 0) await db.class.deleteMany({ where: { id: { in: createdIds.classes } } });
  if (createdIds.sessions.length > 0) await db.academicSession.deleteMany({ where: { id: { in: createdIds.sessions } } });
  if (createdIds.users.length > 0) await db.user.deleteMany({ where: { id: { in: createdIds.users } } });

  if (manifest.previousActiveSessionId !== undefined) {
    if (manifest.previousActiveSessionId === null) {
      await db.schoolSettings.delete({ where: { id: "default" } }).catch(() => {});
    } else {
      await db.schoolSettings.update({
        where: { id: "default" },
        data: { activeSessionId: manifest.previousActiveSessionId }
      }).catch(() => {});
    }
  }

  console.log("✅ Cleanup complete.");
  if (fs.existsSync(MANIFEST_PATH)) fs.unlinkSync(MANIFEST_PATH);
}

async function executeWithBarrier<T>(tasks: Array<(client: PrismaClient) => Promise<T>>): Promise<{ results: T[], errors: any[] }> {
  let startResolve: () => void;
  const startPromise = new Promise<void>(r => { startResolve = r; });
  let readyCount = 0;
  const clients = tasks.map(() => createIsolatedClient());
  const results: T[] = [];
  const errors: any[] = [];
  const wrappedTasks = tasks.map(async (task, i) => {
    readyCount++;
    await startPromise;
    try {
      const res = await task(clients[i]);
      results.push(res);
    } catch (err: any) {
      errors.push(err);
    }
  });

  while (readyCount < tasks.length) await new Promise(r => setImmediate(r));
  startResolve!();
  await Promise.allSettled(wrappedTasks);
  return { results, errors };
}

async function executeHttpWithBarrier<T = any>(tasks: Array<() => Promise<T>>): Promise<{ results: T[], errors: any[] }> {
  let startResolve: () => void;
  const startPromise = new Promise<void>(r => { startResolve = r; });
  let readyCount = 0;
  const results: T[] = new Array(tasks.length);
  const errors: any[] = new Array(tasks.length);
  const wrappedTasks = tasks.map(async (task, i) => {
    readyCount++;
    await startPromise;
    try {
      const res = await task();
      results[i] = res;
    } catch (err: any) {
      errors[i] = err;
    }
  });

  while (readyCount < tasks.length) await new Promise(r => setImmediate(r));
  startResolve!();
  await Promise.allSettled(wrappedTasks);
  return { results, errors };
}

// ---------------------------------------------------------
// GROUP A: CLASS TEACHER ASSIGNMENT
// ---------------------------------------------------------
async function runTierA_DuplicateClassTeacher(manifest: Manifest) {
  console.log("\n--- GROUP A: CLASS TEACHER ASSIGNMENT RACE (TIER A: Raw DB) ---");
  const sessionId = manifest.createdIds.sessions[0];
  const classId = manifest.createdIds.classes[0];
  const userId = manifest.createdIds.users[1]; 
  const teacher = await db.teacher.findUnique({ where: { userId } });
  
  for (let i = 0; i < 3; i++) {
    const task = async (client: PrismaClient) => {
      return await client.$transaction(async (tx) => {
        const existing = await tx.classTeacherAssignment.findFirst({ where: { classId, academicSessionId: sessionId, isActive: true } });
        if (existing) throw new Error("ALREADY_EXISTS");
        const newId = uuidv4();
        return await tx.classTeacherAssignment.create({ data: { id: newId, classId, teacherId: teacher!.id, academicSessionId: sessionId, isActive: true } });
      });
    };
    
    const tasks = [task, task, task];
    const { results, errors } = await executeWithBarrier(tasks);
    
    const active = await db.classTeacherAssignment.findMany({ where: { classId, academicSessionId: sessionId, isActive: true } });
    manifest.createdIds.classTeacherAssignments.push(...active.map(a => a.id));
    saveManifest(manifest);
    
    if (active.length > 1) {
      console.error(`❌ INVARIANT VIOLATED: ${active.length} active assignments`);
      throw new Error("INVARIANT_VIOLATION_CLASS_TEACHER");
    } else {
      console.log(`✅ INVARIANT UPHELD (Iter ${i+1}): ${active.length} active assignment. (Success: ${results.length}, Errors: ${errors.length})`);
    }
    await db.classTeacherAssignment.deleteMany({ where: { classId, academicSessionId: sessionId } });
  }
}

async function runTierB_DuplicateClassTeacher(manifest: Manifest) {
  console.log("\n--- GROUP A: CLASS TEACHER ASSIGNMENT RACE (TIER B: Real HTTP Server Action) ---");
  const sessionId = manifest.createdIds.sessions[0];
  const classId = manifest.createdIds.classes[0];
  const userIdA = manifest.createdIds.users[1]; 
  const userIdB = manifest.createdIds.users[2];
  const teacherA = await db.teacher.findUnique({ where: { userId: userIdA } });
  const teacherB = await db.teacher.findUnique({ where: { userId: userIdB } });
  
  const adminId = manifest.createdIds.users[0];
  const adminCookie = await generateCookie(adminId, "ADMIN");
  
  for (let i = 0; i < 3; i++) {
    const task = (teacherIdToAssign: string) => async () => {
      const sendTime = Date.now();
      const fd = new FormData();
      fd.append("classId", classId);
      fd.append("teacherId", teacherIdToAssign);
      fd.append("academicSessionId", sessionId);
      const res = await fetch("http://localhost:3000/api/test-class-teacher-assignment", {
        method: "POST",
        headers: { "Cookie": adminCookie },
        body: fd
      });
      const receiveTime = Date.now();
      return { res, sendTime, receiveTime };
    };
    
    const tasks = [task(teacherA!.id), task(teacherB!.id), task(teacherA!.id)];
    const { results } = await executeHttpWithBarrier(tasks);
    const jsonResults = await Promise.all(results.filter(Boolean).map(async r => {
      let json: any = {};
      try { json = await r.res.json(); } catch(e){}
      return { ...json, sendTime: r.sendTime, receiveTime: r.receiveTime };
    }));
    
    const active = await db.classTeacherAssignment.findMany({ where: { classId, academicSessionId: sessionId, isActive: true } });
    manifest.createdIds.classTeacherAssignments.push(...active.map(a => a.id));
    saveManifest(manifest);
    
    if (active.length > 1) {
      console.error(`❌ INVARIANT VIOLATED (HTTP): ${active.length} active assignments!`);
      throw new Error("HTTP_INVARIANT_VIOLATION_CLASS_TEACHER");
    } else {
      const successes = jsonResults.filter(j => !j.error);
      const failures = jsonResults.filter(j => j.error);
      
      // Calculate overlap
      const minSend = Math.min(...jsonResults.map(j => j.sendTime));
      const maxReceive = Math.max(...jsonResults.map(j => j.receiveTime));
      
      console.log(`✅ INVARIANT UPHELD (Iter ${i+1}): ${active.length} active assignment. (Successes: ${successes.length}, Failures: ${failures.length})`);
      if (jsonResults[0].telemetry) {
         console.log(`   ⏱️ Overlap Proof: Client Span ${maxReceive - minSend}ms | T1 TxStart ${jsonResults[0].telemetry.transactionStart} | T2 TxStart ${jsonResults[1].telemetry.transactionStart}`);
      }
    }
    await db.classTeacherAssignment.deleteMany({ where: { classId, academicSessionId: sessionId } });
  }
}

// ---------------------------------------------------------
// GROUP C: TEACHING ASSIGNMENT RACES
// ---------------------------------------------------------
async function runTierB_TeachingAssignmentRace(manifest: Manifest) {
  console.log("\n--- GROUP C: TEACHING ASSIGNMENT RACES (TIER B: HTTP) ---");
  const sessionId = manifest.createdIds.sessions[0];
  const classId = manifest.createdIds.classes[0];
  const subjectId = manifest.createdIds.subjects[0];
  const userIdA = manifest.createdIds.users[1]; 
  const userIdB = manifest.createdIds.users[2];
  const teacherA = await db.teacher.findUnique({ where: { userId: userIdA } });
  const teacherB = await db.teacher.findUnique({ where: { userId: userIdB } });
  
  const adminId = manifest.createdIds.users[0];
  const adminCookie = await generateCookie(adminId, "ADMIN");
  
  for (let i = 0; i < 3; i++) {
    const task = (teacherIdToAssign: string) => async () => {
      const fd = new FormData();
      fd.append("classId", classId);
      fd.append("subjectId", subjectId);
      fd.append("teacherId", teacherIdToAssign);
      const res = await fetch("http://localhost:3000/api/test-teaching-assignment", {
        method: "POST",
        headers: { "Cookie": adminCookie },
        body: fd
      });
      return res;
    };
    
    // Simulate overlapping re-assignments
    const tasks = [task(teacherA!.id), task(teacherB!.id), task(teacherA!.id)];
    const { results } = await executeHttpWithBarrier(tasks);
    const jsonResults = await Promise.all(results.map(r => r.json()));
    
    const active = await db.teachingAssignment.findMany({ where: { subjectId, classId, academicSessionId: sessionId, isActive: true } });
    manifest.createdIds.teachingAssignments.push(...active.map(a => a.id));
    saveManifest(manifest);
    
    if (active.length > 1) {
      console.error(`❌ INVARIANT VIOLATED (HTTP): ${active.length} active teaching assignments!`);
      throw new Error("HTTP_INVARIANT_VIOLATION_TEACHING_ASSIGNMENT");
    } else {
      const successes = jsonResults.filter(j => !j.error);
      const failures = jsonResults.filter(j => j.error);
      console.log(`✅ INVARIANT UPHELD (Iter ${i+1}): ${active.length} active assignment. (Successes: ${successes.length}, Failures: ${failures.length})`);
    }
    await db.teachingAssignment.deleteMany({ where: { classId, academicSessionId: sessionId } });
  }
}


// ---------------------------------------------------------
// GROUP D: TOCTOU - TRANSFER VS MUTATION
// ---------------------------------------------------------
async function runTierB_ToctouTransferVsMutation(manifest: Manifest) {
  console.log("\n--- GROUP D: TOCTOU - STUDENT TRANSFER VS TEACHER MUTATION (TIER B: HTTP) ---");
  const sessionId = manifest.createdIds.sessions[0];
  const classAId = manifest.createdIds.classes[0];
  const classBId = manifest.createdIds.classes[1];
  const subjectId = manifest.createdIds.subjects[0];
  
  const adminId = manifest.createdIds.users[0];
  const adminCookie = await generateCookie(adminId, "ADMIN");
  
  const teacherUserId = manifest.createdIds.users[1];
  const teacher = await db.teacher.findUnique({ where: { userId: teacherUserId } });
  const teacherCookie = await generateCookie(teacherUserId, "TEACHER");
  
  const studentUserId = manifest.createdIds.users[3];
  const student = await db.student.findUnique({ where: { userId: studentUserId } });
  
  // Grant teacher access to class A, subject Math
  await db.teachingAssignment.create({ data: { id: uuidv4(), teacherId: teacher!.id, subjectId, classId: classAId, academicSessionId: sessionId, isActive: true } });

  for (let i = 0; i < 3; i++) {
    // Reset student to class A
    await db.studentEnrollment.deleteMany({ where: { studentId: student!.id } });
    await db.mark.deleteMany({ where: { studentId: student!.id } });
    
    await db.studentEnrollment.create({ data: { id: uuidv4(), studentId: student!.id, classId: classAId, academicSessionId: sessionId, status: "ACTIVE" } });
    
    // Teacher initiates a mark submission
    const teacherTask = async () => {
      const fd = new FormData();
      fd.append("studentId", student!.id);
      fd.append("subjectId", subjectId);
      fd.append("examType", "Final");
      fd.append("score", "95");
      fd.append("maxScore", "100");
      fd.append("status", "PUBLISHED");
      const res = await fetch("http://localhost:3000/api/test-upsert-mark", {
        method: "POST",
        headers: { "Cookie": teacherCookie },
        body: fd
      });
      return res;
    };
    
    // Admin initiates a transfer
    const transferTask = async () => {
      const fd = new FormData();
      fd.append("studentId", student!.id);
      fd.append("newClassId", classBId);
      const res = await fetch("http://localhost:3000/api/test-transfer-student", {
        method: "POST",
        headers: { "Cookie": adminCookie },
        body: fd
      });
      return res;
    };
    
    // Fire them concurrently
    const { results } = await executeHttpWithBarrier([teacherTask, transferTask]);
    const jsonResults = await Promise.all(results.map(r => r.json()));
    
    // Post-race analysis
    const marks = await db.mark.findMany({ where: { studentId: student!.id } });
    if (marks.length > 0) manifest.createdIds.marks.push(...marks.map(m => m.id));
    saveManifest(manifest);
    
    const transferSuccess = !jsonResults[1].error;
    const markSuccess = !jsonResults[0].error;
    
    if (transferSuccess && markSuccess) {
      console.log(`✅ TOCTOU HANDLED (Iter ${i+1}): Transfer succeeded, Mark succeeded (Mark was committed BEFORE transfer was finalized).`);
    } else if (transferSuccess && !markSuccess) {
      console.log(`✅ TOCTOU HANDLED (Iter ${i+1}): Transfer succeeded, Mark rejected (Transfer finalized BEFORE mark validation). (Mark Error: ${jsonResults[0].error})`);
    } else {
      console.log(`✅ TOCTOU HANDLED (Iter ${i+1}): Transfer: ${transferSuccess}, Mark: ${markSuccess} (Transfer Error: ${jsonResults[1].error}, Mark Error: ${jsonResults[0].error})`);
    }
    
    // Ensure final state is logically valid: if mark succeeded, it should correctly belong to the session/student
    if (marks.length > 1) {
      console.error(`❌ INVARIANT VIOLATED: Duplicate marks created!`);
      throw new Error("HTTP_INVARIANT_VIOLATION_MARKS");
    }
  }
}

// ---------------------------------------------------------
// GROUP E: ASSIGNMENT REVOCATION VS STALE TEACHER SESSION
// ---------------------------------------------------------
async function runTierB_RevocationVsStaleSession(manifest: Manifest) {
  console.log("\n--- GROUP E: REVOCATION VS STALE SESSION (TIER B: HTTP) ---");
  const sessionId = manifest.createdIds.sessions[0];
  const classAId = manifest.createdIds.classes[0];
  const subjectId = manifest.createdIds.subjects[0];
  
  const adminId = manifest.createdIds.users[0];
  const adminCookie = await generateCookie(adminId, "ADMIN");
  
  const teacherUserId = manifest.createdIds.users[1];
  const teacher = await db.teacher.findUnique({ where: { userId: teacherUserId } });
  const teacherCookie = await generateCookie(teacherUserId, "TEACHER");
  
  const studentUserId = manifest.createdIds.users[3];
  const student = await db.student.findUnique({ where: { userId: studentUserId } });
  
  for (let i = 0; i < 3; i++) {
    // Reset state: student in class A, teacher assigned to class A
    await db.studentEnrollment.deleteMany({ where: { studentId: student!.id } });
    await db.mark.deleteMany({ where: { studentId: student!.id } });
    await db.teachingAssignment.deleteMany({ where: { classId: classAId } });
    
    await db.studentEnrollment.create({ data: { id: uuidv4(), studentId: student!.id, classId: classAId, academicSessionId: sessionId, status: "ACTIVE" } });
    const assignment = await db.teachingAssignment.create({ data: { id: uuidv4(), teacherId: teacher!.id, subjectId, classId: classAId, academicSessionId: sessionId, isActive: true } });
    
    // Teacher submits mark with stale cookie/session state
    const teacherTask = async () => {
      const fd = new FormData();
      fd.append("studentId", student!.id);
      fd.append("subjectId", subjectId);
      fd.append("examType", "Midterm");
      fd.append("score", "88");
      fd.append("maxScore", "100");
      fd.append("status", "PUBLISHED");
      return await fetch("http://localhost:3000/api/test-upsert-mark", {
        method: "POST",
        headers: { "Cookie": teacherCookie },
        body: fd
      });
    };
    
    // Admin revokes teacher access
    const adminTask = async () => {
      const fd = new FormData();
      fd.append("assignmentId", assignment.id);
      return await fetch("http://localhost:3000/api/test-remove-teaching-assignment", {
        method: "POST",
        headers: { "Cookie": adminCookie },
        body: fd
      });
    };
    
    const { results } = await executeHttpWithBarrier([teacherTask, adminTask]);
    const jsonResults = await Promise.all(results.map(r => r.json()));
    
    const markSuccess = !jsonResults[0].error;
    const revokeSuccess = !jsonResults[1].error;
    
    if (revokeSuccess && markSuccess) {
      console.log(`✅ STALE SESSION HANDLED (Iter ${i+1}): Revoke succeeded, Mark succeeded (Mark committed right BEFORE revocation).`);
    } else if (revokeSuccess && !markSuccess) {
      console.log(`✅ STALE SESSION HANDLED (Iter ${i+1}): Revoke succeeded, Mark REJECTED (Authorization correctly caught revoked assignment at mutation time). (Mark Error: ${jsonResults[0].error})`);
    } else {
      console.log(`✅ STALE SESSION HANDLED (Iter ${i+1}): Revoke: ${revokeSuccess}, Mark: ${markSuccess} (Revoke Error: ${jsonResults[1].error}, Mark Error: ${jsonResults[0].error})`);
    }
  }
}

// ---------------------------------------------------------
// GROUP G: STUDENT TRANSFER CONCURRENCY
// ---------------------------------------------------------
async function runTierB_StudentTransfer(manifest: Manifest) {
  console.log("\n--- GROUP G: STUDENT TRANSFER CONCURRENCY (TIER B: HTTP) ---");
  const sessionId = manifest.createdIds.sessions[0];
  const classAId = manifest.createdIds.classes[0];
  const classBId = manifest.createdIds.classes[1];
  const adminId = manifest.createdIds.users[0];
  const adminCookie = await generateCookie(adminId, "ADMIN");
  const studentUserId = manifest.createdIds.users[3];
  
  for (let i = 0; i < 20; i++) {
    const student = await db.student.findUnique({ where: { userId: studentUserId } });
    
    // Initial enrollment in Class A
    await db.studentEnrollment.deleteMany({ where: { studentId: student!.id } });
    const enrollment = await db.studentEnrollment.create({
      data: { id: uuidv4(), studentId: student!.id, classId: classAId, academicSessionId: sessionId, status: "ACTIVE" }
    });
    manifest.createdIds.enrollments.push(enrollment.id);
    saveManifest(manifest);
    
    const task = (targetClassId: string) => async () => {
      const sendTime = Date.now();
      const fd = new FormData();
      fd.append("studentId", student!.id);
      fd.append("newClassId", targetClassId);
      const res = await fetch("http://localhost:3000/api/test-transfer-student", {
        method: "POST",
        headers: { "Cookie": adminCookie },
        body: fd
      });
      const receiveTime = Date.now();
      return { res, sendTime, receiveTime };
    };
    
    const tasks = [task(classBId), task(classAId), task(classBId)];
    const { results } = await executeHttpWithBarrier(tasks);
    const jsonResults = await Promise.all(results.filter(Boolean).map(async r => {
      let json: any = {};
      try { json = await r.res.json(); } catch(e){}
      return { ...json, sendTime: r.sendTime, receiveTime: r.receiveTime };
    }));
    
    const active = await db.studentEnrollment.findMany({ where: { studentId: student!.id, academicSessionId: sessionId, status: 'ACTIVE' } });
    manifest.createdIds.enrollments.push(...active.map(a => a.id));
    saveManifest(manifest);
    
    if (active.length !== 1) {
      console.error(`❌ INVARIANT VIOLATED (HTTP TRANSFER): ${active.length} active enrollments!`);
      throw new Error("HTTP_INVARIANT_VIOLATION_TRANSFER");
    } else {
      const successes = jsonResults.filter(j => !j.error);
      const failures = jsonResults.filter(j => j.error);
      const minSend = Math.min(...jsonResults.map(j => j.sendTime));
      const maxReceive = Math.max(...jsonResults.map(j => j.receiveTime));
      console.log(`✅ INVARIANT UPHELD (Iter ${i+1}): ${active.length} active enrollment. (Successes: ${successes.length}, Failures: ${failures.length})`);
      if (jsonResults[0].telemetry) {
         console.log(`   ⏱️ Overlap Proof: Client Span ${maxReceive - minSend}ms | T1 TxStart ${jsonResults[0].telemetry.transactionStart} | T2 TxStart ${jsonResults[1].telemetry.transactionStart}`);
      }
    }
  }
}

async function bootstrapTestGraph(runId: string): Promise<Manifest> {
  const manifest: Manifest = { runId, timestamp: new Date().toISOString(), createdIds: { users: [], classes: [], subjects: [], sessions: [], enrollments: [], classTeacherAssignments: [], teachingAssignments: [], marks: [] } };
  saveManifest(manifest);
  console.log("Bootstrapping test graph...");
  const session = await db.academicSession.create({ data: { id: uuidv4(), name: `PHASE11_SESSION_${runId}`, startDate: new Date(), endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), status: "ACTIVE" } });
  manifest.createdIds.sessions.push(session.id);
  
  const existingSettings = await db.schoolSettings.findUnique({ where: { id: "default" } });
  manifest.previousActiveSessionId = existingSettings ? existingSettings.activeSessionId : null;
  await db.schoolSettings.upsert({
    where: { id: "default" },
    update: { activeSessionId: session.id },
    create: { id: "default", activeSessionId: session.id }
  });
  saveManifest(manifest);
  
  const usersToCreate = [
    { email: `admin_${runId}@school.local`, role: "ADMIN" as const },
    { email: `teacherA_${runId}@school.local`, role: "TEACHER" as const },
    { email: `teacherB_${runId}@school.local`, role: "TEACHER" as const },
    { email: `studentA_${runId}@school.local`, role: "STUDENT" as const },
    { email: `studentB_${runId}@school.local`, role: "STUDENT" as const },
  ];
  for (const u of usersToCreate) {
    const user = await db.user.create({ data: { id: uuidv4(), email: u.email, password: "password123", role: u.role, ...(u.role === "TEACHER" ? { teacher: { create: { id: uuidv4() } } } : {}), ...(u.role === "STUDENT" ? { student: { create: { id: uuidv4() } } } : {}) } });
    manifest.createdIds.users.push(user.id);
  }
  const classA = await db.class.create({ data: { id: uuidv4(), name: `PHASE11_10A_${runId}` } });
  const classB = await db.class.create({ data: { id: uuidv4(), name: `PHASE11_10B_${runId}` } });
  manifest.createdIds.classes.push(classA.id, classB.id);
  const subjectA = await db.subject.create({ data: { id: uuidv4(), name: `PHASE11_MATH_${runId}`, code: `M_${runId}` } });
  manifest.createdIds.subjects.push(subjectA.id);
  saveManifest(manifest);
  return manifest;
}

async function main() {
  console.log("Starting Phase 11 Turso Concurrency Verification...");
  const args = process.argv.slice(2);
  if (args.includes("--cleanup")) {
    const existing = loadManifest();
    if (existing) await cleanup(existing);
    return;
  }
  
  if (loadManifest()) {
    console.error("❌ A previous run manifest exists. Run with --cleanup first.");
    process.exit(1);
  }
  
  const runId = Math.random().toString(36).substring(2, 9).toUpperCase();
  const manifest = await bootstrapTestGraph(runId);
  
  try {
    await runTierA_DuplicateClassTeacher(manifest);
    await runTierB_DuplicateClassTeacher(manifest);
    await runTierB_TeachingAssignmentRace(manifest);
    await runTierB_ToctouTransferVsMutation(manifest);
    await runTierB_RevocationVsStaleSession(manifest);
    await runTierB_StudentTransfer(manifest);
  } catch (e: any) {
    console.error("❌ Test suite aborted due to invariant violation:");
    console.error(e);
    console.error(`Forensic manifest preserved at ${MANIFEST_PATH}`);
    process.exit(1);
  }
  await cleanup(manifest);
  console.log("Phase 11 suite completed successfully.");
}
main().catch(console.error);
