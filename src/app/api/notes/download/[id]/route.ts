import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth/session'
import prisma from '@/lib/prisma'
import { createSignedDownloadUrl } from '@/lib/storage'
import { ContentStatus } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifySession()
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'PDF' or 'VIDEO'
    
    if (type !== 'PDF' && type !== 'VIDEO') {
      return new NextResponse('Invalid resource type', { status: 400 })
    }

    let storagePath = ""
    let bucket = ""
    let isPublished = false

    if (type === 'PDF') {
      const pdf = await prisma.learningPdf.findUnique({
        where: { id },
        include: { topic: { include: { chapter: true } } }
      })
      if (!pdf) return new NextResponse('Not found', { status: 404 })
      
      // Check authorization
      await authorizeAccess(session, pdf.topic.chapter.subjectId, pdf.topic.chapter.academicSessionId, pdf.topic.chapter.classId)
      
      storagePath = pdf.storagePath
      bucket = 'learning-notes'
      isPublished = pdf.status === ContentStatus.PUBLISHED
    } else {
      const video = await prisma.learningVideo.findUnique({
        where: { id },
        include: { topic: { include: { chapter: true } } }
      })
      if (!video) return new NextResponse('Not found', { status: 404 })
      
      await authorizeAccess(session, video.topic.chapter.subjectId, video.topic.chapter.academicSessionId, video.topic.chapter.classId)
      
      storagePath = video.storagePath
      bucket = 'learning-videos'
      isPublished = video.status === ContentStatus.PUBLISHED
    }

    // Students can only access published content
    if (session.role === 'STUDENT' && !isPublished) {
      return new NextResponse('Forbidden: Content is not published', { status: 403 })
    }

    // Generate signed URL (valid for 1 hour)
    const signedUrl = await createSignedDownloadUrl(bucket, storagePath, 3600)
    
    // Redirect the client to the actual Supabase signed URL
    return NextResponse.redirect(signedUrl)

  } catch (error: any) {
    console.error('Download error:', error)
    if (error.message?.includes('Forbidden') || error.message?.includes('Authorization denied')) {
      return new NextResponse(error.message, { status: 403 })
    }
    if (error.message?.includes('Object not found')) {
      return new NextResponse('File not found in storage', { status: 404 })
    }
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 })
  }
}

import { assertTeacherCanManageContent } from '@/lib/auth/teacher-authorization'

async function authorizeAccess(session: any, subjectId: string, academicSessionId: string, classId: string | null) {
  if (session.role === 'ADMIN') return true

  if (session.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
    if (!teacher) throw new Error('Forbidden')
    
    try {
      console.log(`Checking assertTeacherCanManageContent for teacherId=${teacher.id}, subjectId=${subjectId}, classId=${classId}`);
      await assertTeacherCanManageContent(teacher.id, subjectId, academicSessionId, classId || undefined)
      return true
    } catch (e: any) {
      console.log(`assertTeacherCanManageContent failed: ${e.message}`);
      throw new Error(e.message)
    }
  }

  if (session.role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { userId: session.userId } })
    if (!student) throw new Error('Student not found')

    // Verify student has ACTIVE enrollment
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: {
        studentId: student.id,
        academicSessionId,
        status: 'ACTIVE'
      }
    })

    if (!enrollment) {
      throw new Error('Forbidden: Not enrolled in this academic session')
    }

    // If chapter is scoped to a class, verify student is in that class
    if (classId && classId !== enrollment.classId) {
      throw new Error('Forbidden: This content is for a different class')
    }

    // Check if subject is assigned to student's class (TeachingAssignment)
    const assignment = await prisma.teachingAssignment.findFirst({
      where: {
        subjectId,
        classId: enrollment.classId,
        academicSessionId,
        isActive: true
      }
    })

    if (!assignment) {
      throw new Error('Forbidden: Subject not taught in your class')
    }

    return true
  }

  throw new Error('Forbidden')
}
