"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileText, Video, MessageSquare, Download, Lock } from "lucide-react"
import { ExplanationRenderer } from "@/components/ui/explanation-renderer"

export function StudentHubViewer({ chapters, activeSessionId }: { chapters: any[], activeSessionId: string }) {
  const [viewingExplanationFor, setViewingExplanationFor] = useState<string | null>(null)
  const [explanationData, setExplanationData] = useState<any[]>([])

  return (
    <div className="space-y-6">
      {chapters.map(chapter => (
        <div key={chapter.id} className="border rounded-md shadow-sm bg-white overflow-hidden">
          <div className="bg-slate-100 p-4 border-b font-medium text-lg">
            {chapter.title}
          </div>

          <div className="p-4 space-y-4">
            {chapter.topics?.map((topic: any) => (
              <div key={topic.id} className="border border-slate-200 rounded-md p-4 bg-slate-50">
                <h3 className="font-semibold text-lg mb-4 border-b pb-2">{topic.title}</h3>

                <div className="space-y-4">
                  {/* PDFs */}
                  {topic.pdfs && topic.pdfs.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-slate-500 mb-2 uppercase flex items-center gap-1">
                        <FileText className="h-4 w-4" /> Notes & PDFs
                      </h4>
                      <ul className="space-y-2">
                        {topic.pdfs.map((pdf: any) => (
                          <li key={pdf.id} className="text-sm border p-3 rounded-md bg-white flex justify-between items-center shadow-sm">
                            <span className="font-medium">{pdf.title}</span>
                            <a href={`/api/notes/download/${pdf.id}?type=PDF`} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="outline" className="flex gap-2">
                                <Download className="h-4 w-4" /> Download
                              </Button>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* VIDEOS */}
                  {topic.videos && topic.videos.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-slate-500 mb-2 uppercase flex items-center gap-1 mt-4">
                        <Video className="h-4 w-4" /> Videos
                      </h4>
                      <ul className="space-y-2">
                        {topic.videos.map((vid: any) => (
                          <li key={vid.id} className="text-sm border p-3 rounded-md bg-white flex justify-between items-center shadow-sm">
                            <span className="font-medium">{vid.title}</span>
                            <a href={`/api/notes/download/${vid.id}?type=VIDEO`} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="outline" className="flex gap-2">
                                <Download className="h-4 w-4" /> Download
                              </Button>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* EXPLANATION */}
                  {topic.explanation && (
                    <div>
                      <h4 className="font-medium text-sm text-slate-500 mb-2 uppercase flex items-center gap-1 mt-4">
                        <MessageSquare className="h-4 w-4" /> Interactive Explanation
                      </h4>
                      <Button variant="default" size="sm" onClick={() => {
                        setExplanationData(JSON.parse(topic.explanation.content))
                        setViewingExplanationFor(topic.id)
                      }}>View Explanation</Button>

                      {viewingExplanationFor === topic.id && (
                        <div className="mt-4 p-4 border-2 border-slate-200 bg-white rounded-md shadow-inner">
                          <ExplanationRenderer nodes={explanationData} />
                          <div className="mt-4 flex gap-2 border-t pt-4">
                            <Button variant="ghost" onClick={() => setViewingExplanationFor(null)}>Close</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {(!chapter.topics || chapter.topics.length === 0) && (
              <div className="text-sm text-slate-500 italic p-4 text-center">No topics available yet.</div>
            )}
          </div>
        </div>
      ))}
      {chapters.length === 0 && (
        <div className="text-center p-8 text-slate-500 bg-slate-50 border border-dashed rounded-md">
          No learning materials have been published for this subject yet.
        </div>
      )}
    </div>
  )
}
