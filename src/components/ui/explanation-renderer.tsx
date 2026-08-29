'use client'

import React, { useState } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Info } from 'lucide-react'

// Define the AST node types
export type ASTNode =
  | { type: 'text'; content: string }
  | { type: 'annotation'; content: string; explanation: ASTNode[] }

interface ExplanationRendererProps {
  nodes: ASTNode[]
  depth?: number
}

export function ExplanationRenderer({ nodes, depth = 0 }: ExplanationRendererProps) {
  if (!Array.isArray(nodes)) return null

  return (
    <span className="leading-relaxed">
      {nodes.map((node, index) => {
        if (node.type === 'text') {
          return <span key={index}>{node.content}</span>
        }
        
        if (node.type === 'annotation') {
          return (
            <Popover key={index}>
              <PopoverTrigger>
                <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer transition-colors border border-blue-200 font-medium">
                  {node.content}
                  <Info className="w-3 h-3 opacity-70" />
                </span>
              </PopoverTrigger>
              <PopoverContent 
                className="w-80 p-4 text-sm leading-relaxed shadow-lg z-50 bg-white"
                sideOffset={4}
              >
                <div className="font-semibold mb-2 pb-2 border-b text-blue-900 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Explanation: {node.content}
                </div>
                {node.explanation && node.explanation.length > 0 ? (
                  <ExplanationRenderer nodes={node.explanation} depth={depth + 1} />
                ) : (
                  <span className="italic text-gray-500">No explanation provided.</span>
                )}
              </PopoverContent>
            </Popover>
          )
        }

        return null
      })}
    </span>
  )
}
