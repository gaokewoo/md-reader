import { useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'

interface MarkdownViewerProps {
  content: string
  mode: 'preview' | 'markdown'
}

export default function MarkdownViewer({ content, mode }: MarkdownViewerProps) {
  useEffect(() => {
    // Scroll to top when content changes
    const container = document.getElementById('viewer-container')
    if (container) {
      container.scrollTop = 0
    }
  }, [content])

  if (mode === 'markdown') {
    return (
      <div id="viewer-container" className="h-full overflow-auto bg-gray-50">
        <pre className="p-6 text-sm font-mono leading-relaxed text-gray-800 whitespace-pre-wrap break-words">
          {content}
        </pre>
      </div>
    )
  }

  return (
    <div id="viewer-container" className="h-full overflow-auto bg-white">
      <div className="max-w-4xl mx-auto p-8">
        <ReactMarkdown
          className="markdown-body"
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            img: ({ src, alt }) => {
              // Handle relative image paths
              return (
                <img
                  src={src}
                  alt={alt}
                  className="max-w-full h-auto rounded-lg shadow-md"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              )
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}
