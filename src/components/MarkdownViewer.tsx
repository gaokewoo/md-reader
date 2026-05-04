import { useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

// Counter for generating unique heading IDs
let headingCounter = 0

interface MarkdownViewerProps {
  content: string
  mode: 'preview' | 'markdown'
  currentFilePath: string | null
  onFileLinkClick: (filePath: string) => void
  bgTheme?: 'white' | 'dark' | 'eye-care'
}

const FILE_PATH_PATTERN = /^(\.\/|\.\.\/|[\w\-]+\/|[A-Za-z]:\\|\/|[\w\-]+\.[\w]+)/

function isMdFilePath(text: string): boolean {
  // Must contain a dot (file extension) and look like a path
  if (!text.includes('.')) return false
  // Reject plain snake_case identifiers like time_range, foo_bar
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(text)) return false
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

export default function MarkdownViewer({ content, mode, currentFilePath, onFileLinkClick, bgTheme = 'white' }: MarkdownViewerProps) {
  const isMd = isMarkdownFile(currentFilePath)

  const themeBg = bgTheme === 'dark' ? 'bg-gray-900' : bgTheme === 'eye-care' ? 'bg-[#c7edcc]' : 'bg-white'
  const themeText = bgTheme === 'dark' ? 'text-gray-100' : 'text-gray-800'

  // Reset heading counter when content changes
  useEffect(() => {
    headingCounter = 0
  }, [content])

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
      <div className={`h-full ${themeBg} ${themeText}`}>
        <SourceCodeContent content={content} filePath={currentFilePath} bgTheme={bgTheme} />
      </div>
    )
  }

  // Markdown raw text mode
  if (mode === 'markdown') {
    return (
      <div className={`h-full ${themeBg} ${themeText}`}>
        <pre className={`p-6 text-sm font-mono leading-relaxed whitespace-pre-wrap break-words ${themeText}`}>
          {content}
        </pre>
      </div>
    )
  }

  // Markdown preview mode
  return (
    <div className={`h-full ${themeBg}`}>
      <div className="max-w-4xl mx-auto p-8">
        <ReactMarkdown
          className="markdown-body"
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            // Custom heading renderer with IDs for TOC navigation
            h1: ({ children }) => {
              const id = `heading-${headingCounter++}`
              return <h1 id={id}>{children}</h1>
            },
            h2: ({ children }) => {
              const id = `heading-${headingCounter++}`
              return <h2 id={id}>{children}</h2>
            },
            h3: ({ children }) => {
              const id = `heading-${headingCounter++}`
              return <h3 id={id}>{children}</h3>
            },
            h4: ({ children }) => {
              const id = `heading-${headingCounter++}`
              return <h4 id={id}>{children}</h4>
            },
            h5: ({ children }) => {
              const id = `heading-${headingCounter++}`
              return <h5 id={id}>{children}</h5>
            },
            h6: ({ children }) => {
              const id = `heading-${headingCounter++}`
              return <h6 id={id}>{children}</h6>
            },
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
function SourceCodeContent({ content, filePath, bgTheme = 'white' }: { content: string; filePath: string | null; bgTheme?: 'white' | 'dark' | 'eye-care' }) {
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

  const preBg = bgTheme === 'dark' ? 'bg-gray-800' : bgTheme === 'eye-care' ? 'bg-[#b8dfc0]' : 'bg-gray-50'
  const textColor = bgTheme === 'dark' ? 'text-gray-100' : 'text-gray-800'

  return (
    <pre className={`p-6 text-sm font-mono leading-relaxed overflow-x-auto ${preBg} ${textColor}`}>
      <code className={`language-${language || 'plaintext'}`} dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
    </pre>
  )
}
