'use client'

import React, { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Plus, X, Type, Edit2 } from 'lucide-react'
import type { ASTNode } from './explanation-renderer'

interface ExplanationEditorProps {
  initialNodes?: ASTNode[]
  onChange: (nodes: ASTNode[]) => void
  maxDepth?: number
}

// A simplified block builder for the AST
export function ExplanationEditor({ initialNodes = [], onChange, maxDepth = 5 }: ExplanationEditorProps) {
  const [nodes, setNodes] = useState<ASTNode[]>(initialNodes.length ? initialNodes : [{ type: 'text', content: '' }])

  const triggerChange = (newNodes: ASTNode[]) => {
    setNodes(newNodes)
    onChange(newNodes)
  }

  return (
    <div className="border rounded-md p-4 space-y-4 bg-gray-50/50">
      <NodeList nodes={nodes} onChange={triggerChange} depth={1} maxDepth={maxDepth} />
    </div>
  )
}

function NodeList({ nodes, onChange, depth, maxDepth }: { nodes: ASTNode[], onChange: (n: ASTNode[]) => void, depth: number, maxDepth: number }) {
  
  const updateNode = (index: number, newNode: ASTNode) => {
    const newNodes = [...nodes]
    newNodes[index] = newNode
    onChange(newNodes)
  }

  const removeNode = (index: number) => {
    const newNodes = nodes.filter((_, i) => i !== index)
    // If empty, ensure at least one text node
    if (newNodes.length === 0) {
      newNodes.push({ type: 'text', content: '' })
    }
    onChange(newNodes)
  }

  const addTextNode = (index: number) => {
    const newNodes = [...nodes]
    newNodes.splice(index + 1, 0, { type: 'text', content: '' })
    onChange(newNodes)
  }

  const addAnnotationNode = (index: number) => {
    if (depth >= maxDepth) {
      alert(`Maximum nesting depth of ${maxDepth} reached.`)
      return
    }
    const newNodes = [...nodes]
    newNodes.splice(index + 1, 0, { type: 'annotation', content: 'New Term', explanation: [{ type: 'text', content: '' }] })
    onChange(newNodes)
  }

  return (
    <div className="space-y-3">
      {nodes.map((node, index) => (
        <div key={index} className="relative group border rounded-md bg-white shadow-sm p-3 border-l-4 border-l-blue-400">
          <div className="absolute -left-10 top-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
             <button onClick={() => removeNode(index)} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200" title="Remove block">
               <X className="w-4 h-4" />
             </button>
          </div>

          {node.type === 'text' ? (
            <Textarea
              value={node.content}
              onChange={(e) => updateNode(index, { type: 'text', content: e.target.value })}
              placeholder="Enter explanatory text here..."
              className="min-h-[60px] border-none shadow-none focus-visible:ring-0 resize-y"
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-gray-600">Annotated Term:</span>
                <Input 
                  value={node.content}
                  onChange={(e) => updateNode(index, { ...node, content: e.target.value })}
                  className="w-auto h-8 font-medium text-blue-700 bg-blue-50"
                />
              </div>
              <div className="pl-4 border-l-2 border-gray-200 ml-2">
                <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Explanation</div>
                <NodeList 
                  nodes={node.explanation} 
                  onChange={(expNodes) => updateNode(index, { ...node, explanation: expNodes })}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                />
              </div>
            </div>
          )}
          
          {/* Add block controls below each node */}
          <div className="mt-2 flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
             <Button variant="outline" size="sm" onClick={() => addTextNode(index)} className="h-7 text-xs">
               <Type className="w-3 h-3 mr-1" /> Add Text
             </Button>
             {depth < maxDepth && (
               <Button variant="outline" size="sm" onClick={() => addAnnotationNode(index)} className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50">
                 <Edit2 className="w-3 h-3 mr-1" /> Add Annotation
               </Button>
             )}
          </div>
        </div>
      ))}
    </div>
  )
}
