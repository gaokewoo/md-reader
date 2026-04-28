import { useEffect, useMemo, useRef } from 'react'
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
  currentMatchPos?: number
}

// Check if a string looks like a file path to a markdown document
const MD_PATH_PATTERN = /[\w\-](?:[\w\-./]*\/[\w\-./]+\.(?:md|markdown))/i

function isMdFilePath(text: string): boolean {
  return MD_PATH_PATTERN.test(text)
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

// Highlight search keyword in text content
function highlightSearchInText(text: string, keyword: string, currentMatchPos: number): React.ReactNode[] {
  if (!keyword) return [text]
  const parts: React.ReactNode[] = []
  const lowerText = text.toLowerCase()
  const lowerKeyword = keyword.toLowerCase()
  let lastIndex = 0
  let globalIdx = 0

  let pos = lowerText.indexOf(lowerKeyword)
  while (pos !== -1) {
    if (pos > lastIndex) {
      parts.push(text.slice(lastIndex, pos))
    }
    const isCurrent = currentMatchPos >= 0 && (
      // Check if this match position is within the range of the current match
      globalIdx >= currentMatchPos && globalIdx < currentMatchPos + keyword.length
    )
    // Actually, currentMatchPos is the character position in the full document.
    // We need a different approach: pass an absolute offset tracker.
    parts.push(
      <mark key={`hl-${pos}-${lastIndex}`} className={`search-highlight ${isCurrent ? 'bg-orange-400 text-white' : 'bg-yellow-200'}`} data-pos={globalIdx}>
        {text.slice(pos, pos + keyword.length)}
      </mark>
    )
    lastIndex = pos + keyword.length
    pos = lowerText.indexOf(lowerKeyword, lastIndex)
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

export default function MarkdownViewer({ content, mode, currentFilePath, onFileLinkClick, searchKeyword, currentMatchPos }: MarkdownViewerProps) {
  const isMd = isMarkdownFile(currentFilePath)
  const viewerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = document.getElementById('viewer-container')
    if (container) {
      container.scrollTop = 0
    }
  }, [content])

  // Scroll to current match in markdown preview
  useEffect(() => {
    if (!searchKeyword || currentMatchPos === undefined || currentMatchPos < 0) return
    const container = document.getElementById('viewer-container')
    if (!container) return
    const marks = container.querySelectorAll('mark.search-highlight')
    // Find the mark whose text content position matches
    // Simpler: just scroll to the marks
    if (marks.length > 0) {
      // Try to find the "current" match - we use the data-pos attribute
      for (const mark of marks) {
        const pos = parseInt(mark.getAttribute('data-pos') || '0', 10)
        if (pos >= currentMatchPos) {
          mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Also update its class to show as current
          mark.classList.add('search-highlight-current')
          mark.classList.remove('search-highlight')
          mark.classList.add('search-highlight')
          break
        }
      }
    }
  }, [currentMatchPos, searchKeyword])

  const handlePathClick = async (relativePath: string) => {
    if (!currentFilePath) return
    const cleanPath = relativePath.replace(/#[\w-]*$/, '').replace(/\?[\w=&]*$/, '')
    const resolved = await window.electronAPI.resolveFilePath(currentFilePath, cleanPath)
    if (resolved) {
      onFileLinkClick(resolved)
    }
  }

  // For non-markdown files, show plain text with search highlights
  if (!isMd) {
    return (
      <PlainTextViewer
        content={content}
        filePath={currentFilePath}
        searchKeyword={searchKeyword}
        currentMatchPos={currentMatchPos}
      />
    )
  }

  // Markdown raw text mode
  if (mode === 'markdown') {
    return (
      <div id="viewer-container" className="h-full overflow-auto bg-gray-50">
        <pre className="p-6 text-sm font-mono leading-relaxed text-gray-800 whitespace-pre-wrap break-words">
          {searchKeyword ? highlightSearchInText(content, searchKeyword, currentMatchPos ?? -1) : content}
        </pre>
      </div>
    )
  }

  // Markdown preview mode
  return (
    <div id="viewer-container" className="h-full overflow-auto bg-white" ref={viewerRef}>
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

              const isMdLink = /\.(md|markdown)(#[\w-]*)?(\?[\w=&]*)?$/i.test(href)
              const isRelativeLink = href.startsWith('./') || href.startsWith('../') || href.startsWith('/') ||
                (!href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('ftp'))

              if (isMdLink && isRelativeLink && currentFilePath) {
                return (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      handlePathClick(href)
                    }}
                    className="text-blue-600 hover:underline cursor-pointer font-medium"
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

// Plain text viewer with search highlights and syntax highlighting
function PlainTextViewer({ content, filePath, searchKeyword, currentMatchPos }: {
  content: string; filePath: string | null; searchKeyword?: string; currentMatchPos?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
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

  // Inject search highlights into the HTML
  const htmlWithSearch = useMemo(() => {
    if (!searchKeyword) return highlightedHtml
    // We need to highlight the keyword in the already-syntax-highlighted HTML.
    // This is tricky because the HTML contains tags. We'll do a simple approach:
    // find keyword in text nodes and wrap them with <mark>.
    // For simplicity, we'll search in the plain text and map positions to the HTML.
    // A simpler approach: just search the HTML for the keyword text (which may break tags)
    // Safer approach: use the plain text content to find positions, then manipulate the HTML.

    // Simplest safe approach: highlight in the raw text, then syntax highlight
    // But that conflicts with hljs. So we'll use a post-processing approach:
    // Add <mark> tags only within text nodes of the HTML.
    const escaped = searchKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escaped})`, 'gi')
    // Only replace in text between > and < (i.e., visible text)
    return highlightedHtml.replace(/>([^<]+)</g, (_fullMatch, textContent: string) => {
      const highlighted = textContent.replace(regex, (m: string) => `<mark class="search-highlight bg-yellow-200">${m}</mark>`)
      return `>${highlighted}<`
    })
  }, [highlightedHtml, searchKeyword])

  // Scroll to current match
  useEffect(() => {
    if (!searchKeyword || currentMatchPos === undefined || currentMatchPos < 0) return
    const container = containerRef.current
    if (!container) return
    // Use window.find approach or just scroll to first mark
    const marks = container.querySelectorAll('mark.search-highlight')
    if (marks.length > 0) {
      // Calculate which mark to scroll to based on position
      const charPos = currentMatchPos
      let accLen = 0
      for (let i = 0; i < marks.length; i++) {
        accLen += marks[i].textContent?.length || 0
        if (i * searchKeyword.length <= charPos) {
          marks[i].scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
      // Simple: just scroll to the first mark for now
      const idx = Math.floor(charPos / (searchKeyword.length || 1))
      if (idx >= 0 && idx < marks.length) {
        marks[idx].scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Add current highlight style
        marks.forEach(m => m.classList.remove('search-highlight-current'))
        marks[idx].classList.add('search-highlight-current')
        ;(marks[idx] as HTMLElement).style.backgroundColor = '#fb923c'
      }
    }
  }, [currentMatchPos, searchKeyword])

  return (
    <div id="viewer-container" ref={containerRef} className="h-full overflow-auto bg-gray-900">
      <pre className="p-6 text-sm font-mono leading-relaxed overflow-x-auto">
        <code className={`language-${language || 'plaintext'}`} dangerouslySetInnerHTML={{ __html: htmlWithSearch }} />
      </pre>
    </div>
  )
}
