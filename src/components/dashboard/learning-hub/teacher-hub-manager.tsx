"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createChapter, createTopic, updateTopic, requestFileUploadUrl, confirmFileUpload, saveExplanation } from "@/app/actions/notes"
import { Loader2, Plus, FileText, Video, MessageSquare, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { ExplanationEditor } from "@/components/ui/explanation-editor"

export function TeacherHubManager({ subjectId, activeSessionId, initialChapters, classId }: { subjectId: string, activeSessionId: string, initialChapters: any[], classId?: string }) {
  const [chapters, setChapters] = useState(initialChapters)
  const [isCreatingChapter, setIsCreatingChapter] = useState(false)
  const [newChapterTitle, setNewChapterTitle] = useState("")
  const [newTopicTitle, setNewTopicTitle] = useState("")
  const [creatingTopicFor, setCreatingTopicFor] = useState<string | null>(null)
  
  const [uploadingTopicId, setUploadingTopicId] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(false)
  
  const [editingExplanationFor, setEditingExplanationFor] = useState<string | null>(null)
  const [explanationData, setExplanationData] = useState<any[]>([])

  const router = useRouter()

  const handleCreateChapter = async () => {
    if (!newChapterTitle.trim()) return
    try {
      setIsCreatingChapter(true)
      const res = await createChapter({ subjectId, classId, academicSessionId: activeSessionId, title: newChapterTitle })
      toast.success("Chapter created!")
      setNewChapterTitle("")
      router.refresh()
      window.location.reload() // Hack to refresh for now
    } catch (e: any) {
      toast.error(e.message || "Failed to create chapter")
    } finally {
      setIsCreatingChapter(false)
    }
  }

  const handleCreateTopic = async (chapterId: string) => {
    if (!newTopicTitle.trim()) return
    try {
      const res = await createTopic({ chapterId, title: newTopicTitle, expectedSessionId: activeSessionId })
      toast.success("Topic created!")
      setNewTopicTitle("")
      setCreatingTopicFor(null)
      router.refresh()
      window.location.reload()
    } catch (e: any) {
      toast.error(e.message || "Failed to create topic")
    }
  }

  const handlePublishTopic = async (topicId: string, currentTitle: string) => {
    try {
      await updateTopic(topicId, { title: currentTitle, status: "PUBLISHED", expectedSessionId: activeSessionId })
      toast.success("Published!")
      router.refresh()
      window.location.reload()
    } catch (e: any) {
      toast.error(e.message || "Failed to publish")
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, topicId: string, type: 'PDF' | 'VIDEO') => {
    const file = e.target.files?.[0]
    if (!file) return

    if (type === 'PDF' && file.type !== 'application/pdf') {
      toast.error("File must be a PDF")
      return
    }

    try {
      setUploadingTopicId(topicId)
      setUploadProgress(true)
      
      const { resourceId, signedUrl } = await requestFileUploadUrl({
        topicId,
        title: file.name,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        type,
        expectedSessionId: activeSessionId
      })

      // Upload directly to Supabase via signed URL
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      })

      if (!uploadRes.ok) throw new Error("Upload to Supabase failed")

      // Confirm
      await confirmFileUpload({ resourceId, type, expectedSessionId: activeSessionId })
      
      toast.success("Upload complete!")
      router.refresh()
      window.location.reload()
    } catch (err: any) {
      toast.error(err.message || "Upload failed")
    } finally {
      setUploadingTopicId(null)
      setUploadProgress(false)
    }
  }

  const handleSaveExplanation = async (topicId: string) => {
    try {
      await saveExplanation({ topicId, ast: explanationData, status: "PUBLISHED", expectedSessionId: activeSessionId })
      toast.success("Explanation saved!")
      setEditingExplanationFor(null)
      router.refresh()
      window.location.reload()
    } catch(e: any) {
      toast.error(e.message || "Failed to save explanation")
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center bg-slate-50 p-4 rounded-md border">
        <h2 className="text-xl font-semibold">Chapters</h2>
        <div className="flex gap-2">
          <Input 
            placeholder="New Chapter Title" 
            value={newChapterTitle} 
            onChange={e => setNewChapterTitle(e.target.value)} 
          />
          <Button onClick={handleCreateChapter} disabled={isCreatingChapter}>
            {isCreatingChapter ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Add Chapter
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {chapters.map(chapter => (
          <div key={chapter.id} className="border rounded-md shadow-sm bg-white overflow-hidden">
            <div className="bg-slate-100 p-4 border-b font-medium text-lg flex justify-between">
              {chapter.title}
              <Button variant="outline" size="sm" onClick={() => setCreatingTopicFor(chapter.id)}>
                <Plus className="h-4 w-4 mr-2" /> Add Topic
              </Button>
            </div>

            <div className="p-4 space-y-4">
              {creatingTopicFor === chapter.id && (
                <div className="flex gap-2 bg-slate-50 p-2 rounded-md border">
                  <Input 
                    placeholder="New Topic Title" 
                    value={newTopicTitle} 
                    onChange={e => setNewTopicTitle(e.target.value)} 
                  />
                  <Button onClick={() => handleCreateTopic(chapter.id)}>Save Topic</Button>
                  <Button variant="ghost" onClick={() => setCreatingTopicFor(null)}>Cancel</Button>
                </div>
              )}

              {chapter.topics?.map((topic: any) => (
                <div key={topic.id} className="border border-slate-200 rounded-md p-4 bg-slate-50">
                  <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="font-semibold text-lg">{topic.title}</h3>
                    <div className="flex gap-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${topic.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                        {topic.status}
                      </span>
                      {topic.status !== 'PUBLISHED' && (
                        <Button variant="outline" size="sm" onClick={() => handlePublishTopic(topic.id, topic.title)}>Publish</Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* PDFs */}
                    <div>
                      <h4 className="font-medium text-sm text-slate-500 mb-2 uppercase flex items-center gap-1">
                        <FileText className="h-4 w-4" /> PDFs
                      </h4>
                      <ul className="space-y-1 mb-2">
                        {topic.pdfs?.map((pdf: any) => (
                          <li key={pdf.id} className="text-sm border p-2 rounded-md bg-white flex justify-between items-center">
                            <span>{pdf.title}</span>
                            <span className="text-xs bg-slate-100 px-2 rounded-md">{pdf.status}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="file" 
                          accept=".pdf" 
                          onChange={(e) => handleFileUpload(e, topic.id, 'PDF')} 
                          disabled={uploadProgress}
                        />
                        {uploadingTopicId === topic.id && <Loader2 className="h-4 w-4 animate-spin" />}
                      </div>
                    </div>

                    {/* VIDEOS */}
                    <div>
                      <h4 className="font-medium text-sm text-slate-500 mb-2 uppercase flex items-center gap-1">
                        <Video className="h-4 w-4" /> Videos
                      </h4>
                      <ul className="space-y-1 mb-2">
                        {topic.videos?.map((vid: any) => (
                          <li key={vid.id} className="text-sm border p-2 rounded-md bg-white flex justify-between items-center">
                            <span>{vid.title}</span>
                            <span className="text-xs bg-slate-100 px-2 rounded-md">{vid.status}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="file" 
                          accept="video/*" 
                          onChange={(e) => handleFileUpload(e, topic.id, 'VIDEO')} 
                          disabled={uploadProgress}
                        />
                      </div>
                    </div>

                    {/* EXPLANATION */}
                    <div>
                      <h4 className="font-medium text-sm text-slate-500 mb-2 uppercase flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" /> AST Explanation
                      </h4>
                      {topic.explanation ? (
                        <div className="border p-4 bg-white rounded-md mb-2">
                          <p className="text-sm text-green-700 font-medium mb-2">✓ Explanation attached</p>
                          <Button variant="outline" size="sm" onClick={() => {
                            setExplanationData(JSON.parse(topic.explanation.content))
                            setEditingExplanationFor(topic.id)
                          }}>Edit Explanation</Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => {
                          setExplanationData([{ type: 'text', content: 'Start typing here...' }])
                          setEditingExplanationFor(topic.id)
                        }}>Create Explanation</Button>
                      )}

                      {editingExplanationFor === topic.id && (
                        <div className="mt-4 p-4 border-2 border-blue-200 bg-blue-50 rounded-md">
                          <ExplanationEditor initialNodes={explanationData} onChange={setExplanationData} />
                          <div className="mt-4 flex gap-2">
                            <Button onClick={() => handleSaveExplanation(topic.id)}>Save AST to Server</Button>
                            <Button variant="ghost" onClick={() => setEditingExplanationFor(null)}>Cancel</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {(!chapter.topics || chapter.topics.length === 0) && (
                <div className="text-sm text-slate-500 italic p-4 text-center">No topics yet. Create one to add PDFs/Videos.</div>
              )}
            </div>
          </div>
        ))}
        {chapters.length === 0 && (
          <div className="text-center p-8 text-slate-500 bg-slate-50 border border-dashed rounded-md">
            No chapters found. Get started by creating a new chapter above!
          </div>
        )}
      </div>
    </div>
  )
}
