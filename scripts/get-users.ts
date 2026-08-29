import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const teacher = await prisma.user.findFirst({ where: { role: 'TEACHER' }})
  const student = await prisma.user.findFirst({ where: { role: 'STUDENT' }})
  console.log("Teacher email:", teacher?.email)
  console.log("Student email:", student?.email)
}

main().catch(e => console.error(e)).finally(async () => await prisma.$disconnect())
