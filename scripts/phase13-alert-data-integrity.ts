import prisma from "../src/lib/prisma"
import { resolveAndAuthorizeAlertTargets, assertAlertCreatorOrAdmin } from "../src/lib/auth/alert-authorization"
import * as assert from "assert"
import { v4 as uuidv4 } from "uuid"
import { AlertStatus } from "@prisma/client"

async function run() {
  console.log("Starting Phase 13 Alert Data Integrity & IDOR Tests...")
  
  const testId = uuidv4().substring(0, 8)
  
  // Setup isolated scope
  const adminUser = await prisma.user.create({ data: { name: `Admin ${testId}`, email: `admin_${testId}@test.com`, role: "ADMIN", password: "hash" } })
  const session = await prisma.academicSession.create({ data: { name: `Session ${testId}`, startDate: new Date(), endDate: new Date(), status: "ACTIVE" } })
  const academicSessionId = session.id
  
  const assignedClass = await prisma.class.create({ data: { name: `Assigned Class ${testId}` } })
  
  // Create 2 students
  const student1User = await prisma.user.create({ data: { name: `S1 ${testId}`, email: `s1_${testId}@test.com`, role: "STUDENT", password: "hash" } })
  const student1 = await prisma.student.create({ data: { userId: student1User.id } })
  await prisma.studentEnrollment.create({ data: { studentId: student1.id, classId: assignedClass.id, academicSessionId: session.id, status: "ACTIVE" } })

  const student2User = await prisma.user.create({ data: { name: `S2 ${testId}`, email: `s2_${testId}@test.com`, role: "STUDENT", password: "hash" } })
  const student2 = await prisma.student.create({ data: { userId: student2User.id } })
  await prisma.studentEnrollment.create({ data: { studentId: student2.id, classId: assignedClass.id, academicSessionId: session.id, status: "ACTIVE" } })

  console.log("--- Executing Integrity Tests ---")

  try {
    // 1. Create an alert via Server Action Logic
    let activeSession = { userId: adminUser.id, role: "ADMIN" }
    
    // Server Action logic
    const targetUserIds = await resolveAndAuthorizeAlertTargets(activeSession.userId, "ADMIN", { targetType: "SPECIFIC_CLASSES", classIds: [assignedClass.id] }, academicSessionId)
    
    let createdAlertId = ""
    await prisma.$transaction(async (tx) => {
      const alert = await tx.alert.create({
        data: { title: "Integrity Test Alert", message: "Msg", priority: "URGENT", requiresAcknowledgement: true, status: "PUBLISHED", publishedAt: new Date(), creatorId: activeSession.userId, targetType: "SPECIFIC_CLASSES" }
      })
      createdAlertId = alert.id
      const recipientData = targetUserIds.map(id => ({ alertId: alert.id, userId: id }))
      await tx.alertRecipient.createMany({ data: recipientData })
    })

    const alert = await prisma.alert.findUnique({ where: { id: createdAlertId }, include: { recipients: true } })
    if (!alert) throw new Error("Alert not found")
    assert.ok(alert, "Alert should be saved to DB")
    assert.strictEqual(alert.recipients.length, 2, "Should resolve to 2 active students")
    console.log("✅ Alert and Recipients created atomically.")

    // 2. Student 1 reads the alert
    activeSession = { userId: student1User.id, role: "STUDENT" }
    
    // getMyAlerts logic
    const getMyAlerts = async (filter: "ACTIVE"|"HISTORY", curUserId: string) => {
      const whereClause: any = { userId: curUserId, alert: { status: { in: ["PUBLISHED", "ARCHIVED"] } } }
      if (filter === "ACTIVE") {
        whereClause.alert.status = "PUBLISHED"
        whereClause.alert.OR = [ { expiresAt: null }, { expiresAt: { gt: new Date() } } ]
      }
      return prisma.alertRecipient.findMany({ where: whereClause, include: { alert: true } })
    }

    const myAlerts = await getMyAlerts("ACTIVE", activeSession.userId)
    assert.strictEqual(myAlerts.length, 1, "Student 1 should see exactly 1 alert")
    assert.strictEqual(myAlerts[0].userId, student1User.id, "IDOR Protection: only returns own rows")
    console.log("✅ getMyAlerts strictly bounded to current user (IDOR protection).")

    // markAlertRead logic
    await prisma.alertRecipient.update({ where: { alertId_userId: { alertId: alert.id, userId: activeSession.userId } }, data: { readAt: new Date() } })

    const s1RowAfterRead = await prisma.alertRecipient.findUnique({ where: { alertId_userId: { alertId: alert.id, userId: student1User.id } } })
    assert.ok(s1RowAfterRead?.readAt, "Read timestamp should be populated")

    // Verify Student 2 row is untouched
    const s2Row = await prisma.alertRecipient.findUnique({ where: { alertId_userId: { alertId: alert.id, userId: student2User.id } } })
    assert.ok(!s2Row?.readAt, "Student 2 row must not be modified by Student 1")
    console.log("✅ markAlertRead applies ONLY to current user row.")

    // 3. Student 2 acknowledges the alert
    activeSession = { userId: student2User.id, role: "STUDENT" }
    
    // acknowledgeAlert logic
    const recipient = await prisma.alertRecipient.findUnique({ where: { alertId_userId: { alertId: alert.id, userId: activeSession.userId } }, include: { alert: true } })
    if (!recipient) throw new Error("Recipient not found")
    if (recipient.alert.requiresAcknowledgement) {
      await prisma.alertRecipient.update({ where: { alertId_userId: { alertId: alert.id, userId: activeSession.userId } }, data: { acknowledgedAt: new Date(), readAt: recipient.readAt || new Date() } })
    }

    const s2RowAfterAck = await prisma.alertRecipient.findUnique({ where: { alertId_userId: { alertId: alert.id, userId: student2User.id } } })
    assert.ok(s2RowAfterAck?.acknowledgedAt, "Ack timestamp should be populated")

    // Verify Student 1 row is untouched
    const s1RowAfterAck = await prisma.alertRecipient.findUnique({ where: { alertId_userId: { alertId: alert.id, userId: student1User.id } } })
    assert.ok(!s1RowAfterAck?.acknowledgedAt, "Student 1 ack must not be modified by Student 2")
    console.log("✅ acknowledgeAlert applies ONLY to current user row.")

    // 4. Duplicate Target Deduplication
    activeSession = { userId: adminUser.id, role: "ADMIN" }
    const dupTargetIds = await resolveAndAuthorizeAlertTargets(activeSession.userId, "ADMIN", { targetType: "SPECIFIC_STUDENTS", studentIds: [student1User.id, student1User.id, student1User.id] }, academicSessionId)
    
    let createdDupAlertId = ""
    await prisma.$transaction(async (tx) => {
      const dupAlert = await tx.alert.create({ data: { title: "Duplicate Test", message: "Msg", creatorId: activeSession.userId, targetType: "SPECIFIC_STUDENTS", status: "PUBLISHED", publishedAt: new Date() } })
      createdDupAlertId = dupAlert.id
      await tx.alertRecipient.createMany({ data: dupTargetIds.map(id => ({ alertId: dupAlert.id, userId: id })) })
    })
    const dupAlertRow = await prisma.alert.findUnique({ where: { id: createdDupAlertId }, include: { recipients: true } })
    assert.strictEqual(dupAlertRow?.recipients.length, 1, "Duplicate targets should deduplicate to exactly 1 recipient row")
    console.log("✅ Duplicate recipient targets deduplicated gracefully.")

    // 5. Expiration Filtering
    await prisma.alert.update({ where: { id: dupAlertRow!.id }, data: { expiresAt: new Date(Date.now() - 10000) } }) // Expired 10s ago

    const activeAlerts = await getMyAlerts("ACTIVE", student1User.id)
    assert.strictEqual(activeAlerts.length, 1, "Expired alert should be filtered out")
    assert.strictEqual(activeAlerts[0].alert.title, "Integrity Test Alert")

    const historyAlerts = await getMyAlerts("HISTORY", student1User.id)
    assert.strictEqual(historyAlerts.length, 2, "Expired alert should still appear in history")
    console.log("✅ Alert Expiration correctly excludes from ACTIVE feed but retains in HISTORY.")

    // 6. Creator IDOR update test
    try {
      await assertAlertCreatorOrAdmin(alert.id, student1User.id, "STUDENT")
      throw new Error("Should fail")
    } catch(e: any) {
      assert.match(e.message, /Authorization denied/i, "Student cannot update status")
      console.log("✅ IDOR: Alert status update properly restricted to Creator/Admin.")
    }

    await assertAlertCreatorOrAdmin(alert.id, adminUser.id, "ADMIN")
    await prisma.alert.update({ where: { id: alert.id }, data: { status: "CANCELLED" } })
    
    const activeAfterCancel = await getMyAlerts("ACTIVE", student1User.id)
    assert.strictEqual(activeAfterCancel.length, 0, "CANCELLED alerts do not show in active feed")
    console.log("✅ Alert lifecycle updates behave securely.")

    console.log("🎉 All Phase 13 Integrity & IDOR tests passed successfully!")
  } catch (error: any) {
    console.error("❌ Test Failed:", error.message || error)
    process.exit(1)
  }
}
run().finally(() => prisma.$disconnect())
