import { useMemo } from 'react'

export interface TocItem {
  id: string
  text: string
  level: number // 1-6
}

// Extract headings from markdown content
function extractHeadings(content: string): TocItem[] {
  const headings: TocItem[] = []
  const lines = content.split('\n')
  let counter = 0

  for (const line of lines) {
    // Match ATX headings: # Heading, ## Heading, etc.
    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      const text = match[2].replace(/[*_`~\[\]()#]/g, '').trim()
      const id = `heading-${counter++}`
      headings.push({ id, text, level })
    }
  }

  return headings
}

interface TocPanelProps {
  content: string
  visible: boolean
  onHeadingClick: (id: string) => void
}

export default function TocPanel({ content, visible, onHeadingClick }: TocPanelProps) {
  const headings = useMemo(() => extractHeadings(content), [content])

  if (!visible) return null
  if (headings.length === 0) {
    return (
      <div className="h-full flex flex-col bg-gray-50 border-l border-gray-200" style={{ width: 240 }}>
        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-100">
          Outline
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">
          No headings
        </div>
      </div>
    )
  }

  // Calculate min level for indentation
  const minLevel = Math.min(...headings.map(h => h.level))

  return (
    <div className="h-full flex flex-col bg-gray-50 border-l border-gray-200" style={{ width: 240 }}>
      <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-100">
        Outline
      </div>
      <div className="flex-1 overflow-auto py-1">
        {headings.map((h) => (
          <div
            key={h.id}
            className="px-2 py-1 cursor-pointer text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded mx-1 transition-colors truncate"
            style={{ paddingLeft: `${(h.level - minLevel) * 12 + 8}px` }}
            onClick={() => onHeadingClick(h.id)}
            title={h.text}
          >
            {h.text}
          </div>
        ))}
      </div>
    </div>
  )
}
