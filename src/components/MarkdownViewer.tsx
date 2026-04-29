import { useEffect, useMemo, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

interface MarkdownViewerProps {
  content: string
  mode: 'preview' | 'markdown'
  currentFilePath: string | null
  onFileLinkClick: (filePath: string) => void
  searchKeyword?: string
  currentMatchIndex?: number  // 0-based index into the matches array
  onMatchCountChange?: (count: number) => void
}

const FILE_PATH_PATTERN = /[\w][\w\-]*(?:\/[\w\-./]+)*\.\w{1,12}/i

function isMdFilePath(text: string): boolean {
  return FILE_PATH_PATTERN.test(text)
}

function isMarkdownFile(filePath: string | null): boolean {
  if (!filePath) return false
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  return ext === 'md' || ext === 'markdown'
}

function getLanguageFromPath(filePath: string | null): string | undefined {
  if (!filePath) return undefined
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const langMap: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
    java: 'java', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
    cs: 'csharp', swift: 'swift', kt: 'kotlin', scala: 'scala',
    lua: 'lua', r: 'r', pl: 'perl', pm: 'perl', php: 'php',
    sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash',
    ps1: 'powershell', bat: 'dos', cmd: 'dos',
    html: 'xml', htm: 'xml', xml: 'xml', vue: 'xml', svelte: 'xml',
    css: 'css', scss: 'scss', less: 'less', sass: 'scss',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'ini',
    sql: 'sql', graphql: 'graphql', proto: 'protobuf',
    md: 'markdown', markdown: 'markdown',
    diff: 'diff', patch: 'diff',
    dockerfile: 'dockerfile', makefile: 'makefile', cmake: 'cmake',
    ini: 'ini', cfg: 'ini', conf: 'ini', env: 'bash', properties: 'properties',
    csv: 'plaintext', tsv: 'plaintext', log: 'plaintext',
    txt: 'plaintext', text: 'plaintext', rst: 'rst', adoc: 'asciidoc',
    tex: 'latex', gradle: 'groovy',
  }
  return langMap[ext]
}

function FileLinkIcon() {
  return (
    <svg className="w-3 h-3 inline-block ml-0.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

// DOM-based search highlight: find text nodes and wrap matches with <mark>
function applySearchHighlights(container: HTMLElement, keyword: string): number {
  // First, remove any existing highlights
  const existingMarks = container.querySelectorAll('mark.search-highlight')
  for (const mark of existingMarks) {
    const parent = mark.parentNode
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ''), mark)
      parent.normalize() // Merge adjacent text nodes
    }
  }

  if (!keyword) return 0

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    // Skip script/style nodes
    if (node.parentElement?.tagName === 'SCRIPT' || node.parentElement?.tagName === 'STYLE') continue
    if (node.textContent && node.textContent.toLowerCase().includes(keyword.toLowerCase())) {
      textNodes.push(node)
    }
  }

  let matchCount = 0
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')

  for (const textNode of textNodes) {
    const text = textNode.textContent || ''
    const parts = text.split(regex)
    if (parts.length <= 1) continue

    const fragment = document.createDocumentFragment()
    for (const part of parts) {
      if (regex.test(part)) {
        const mark = document.createElement('mark')
        mark.className = 'search-highlight'
        mark.textContent = part
        mark.setAttribute('data-match-index', String(matchCount))
        fragment.appendChild(mark)
        matchCount++
      } else {
        fragment.appendChild(document.createTextNode(part))
      }
    }

    textNode.parentNode?.replaceChild(fragment, textNode)
  }

  return matchCount
}

// Scroll to a specific match and highlight it as current
function scrollToMatch(container: HTMLElement, matchIndex: number) {
  const marks = container.querySelectorAll('mark.search-highlight')
  // Remove current highlight from all
  marks.forEach(m => {
    m.classList.remove('search-highlight-current')
  })

  if (matchIndex >= 0 && matchIndex < marks.length) {
    const target = marks[matchIndex]
    target.classList.add('search-highlight-current')
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

export default function MarkdownViewer({ content, mode, currentFilePath, onFileLinkClick, searchKeyword, currentMatchIndex, onMatchCountChange }: MarkdownViewerProps) {
  const isMd = isMarkdownFile(currentFilePath)
  const containerRef = useRef<HTMLDivElement>(null)

  // Scroll to top when content changes
  useEffect(() => {
    const container = document.getElementById('viewer-container')
    if (container) {
      container.scrollTop = 0
    }
  }, [content])

  // Apply search highlights after DOM renders
  const updateHighlights = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const count = applySearchHighlights(container, searchKeyword || '')
    if (onMatchCountChange) {
      onMatchCountChange(count)
    }

    // Apply current match highlight
    if (currentMatchIndex !== undefined && currentMatchIndex >= 0) {
      scrollToMatch(container, currentMatchIndex)
    }
  }, [searchKeyword, currentMatchIndex, onMatchCountChange])

  // Re-apply highlights when search keyword or content changes
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM has been updated
    const raf = requestAnimationFrame(() => {
      updateHighlights()
    })
    return () => cancelAnimationFrame(raf)
  }, [updateHighlights, content, mode])

  const handlePathClick = async (relativePath: string) => {
    if (!currentFilePath) return
    const resolved = await window.electronAPI.resolveFilePath(currentFilePath, relativePath)
    if (resolved) {
      onFileLinkClick(resolved)
    }
  }

  // For non-markdown files, show plain text with syntax highlighting
  if (!isMd) {
    return (
      <div id="viewer-container" ref={containerRef} className="h-full overflow-auto bg-gray-900">
        <SourceCodeContent content={content} filePath={currentFilePath} />
      </div>
    )
  }

  // Markdown raw text mode
  if (mode === 'markdown') {
    return (
      <div id="viewer-container" ref={containerRef} className="h-full overflow-auto bg-gray-50">
        <pre className="p-6 text-sm font-mono leading-relaxed text-gray-800 whitespace-pre-wrap break-words">
          {content}
        </pre>
      </div>
    )
  }

  // Markdown preview mode
  return (
    <div id="viewer-container" ref={containerRef} className="h-full overflow-auto bg-white">
      <div className="max-w-4xl mx-auto p-8">
        <ReactMarkdown
          className="markdown-body"
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            img: ({ src, alt }) => {
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
            a: ({ href, children }) => {
              if (!href) return <a href={href}>{children}</a>

              // Determine if this is a relative/local file link (not external URL, not anchor)
              const isExternalUrl = href.startsWith('http://') || href.startsWith('https://') || href.startsWith('ftp://') || href.startsWith('mailto:')
              const isAnchor = href.startsWith('#')

              if (!isExternalUrl && !isAnchor && currentFilePath) {
                // This is a relative file link - make it clickable
                return (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      handlePathClick(href)
                    }}
                    className="md-file-link"
                  >
                    {children}
                    <FileLinkIcon />
                  </a>
                )
              }

              return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
            },
            code: ({ className, children, node, ...props }) => {
              const isCodeBlock = typeof className === 'string' && className.startsWith('language-')
              const text = String(children).replace(/\n$/, '')

              if (!isCodeBlock && isMdFilePath(text) && currentFilePath) {
                return (
                  <code
                    className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-sm font-mono cursor-pointer hover:bg-blue-100 transition-colors border border-blue-200"
                    onClick={(e) => {
                      e.preventDefault()
                      handlePathClick(text)
                    }}
                    title={`点击打开: ${text}`}
                    {...props}
                  >
                    {children}
                    <FileLinkIcon />
                  </code>
                )
              }

              return <code className={className} {...props}>{children}</code>
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}

// Source code content with syntax highlighting (rendered as HTML, search highlights applied via DOM)
function SourceCodeContent({ content, filePath }: { content: string; filePath: string | null }) {
  const language = getLanguageFromPath(filePath)

  const highlightedHtml = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(content, { language }).value
      }
      return hljs.highlightAuto(content).value
    } catch {
      return content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }
  }, [content, language])

  return (
    <pre className="p-6 text-sm font-mono leading-relaxed overflow-x-auto">
      <code className={`language-${language || 'plaintext'}`} dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
    </pre>
  )
}
