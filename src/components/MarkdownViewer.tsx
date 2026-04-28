import { useEffect, useMemo } from 'react'
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
}

// Check if a string looks like a file path to a markdown document
const MD_PATH_PATTERN = /[\w\-](?:[\w\-./]*\/[\w\-./]+\.(?:md|markdown))/i

function isMdFilePath(text: string): boolean {
  return MD_PATH_PATTERN.test(text)
}

// Determine if a file is a markdown file based on extension
function isMarkdownFile(filePath: string | null): boolean {
  if (!filePath) return false
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  return ext === 'md' || ext === 'markdown'
}

// Get language hint for highlight.js from file extension
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

// Source code viewer for non-markdown text files
function SourceCodeViewer({ content, filePath }: { content: string; filePath: string | null }) {
  const language = getLanguageFromPath(filePath)

  // Use highlight.js for full file syntax highlighting
  const highlightedHtml = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(content, { language }).value
      }
      return hljs.highlightAuto(content).value
    } catch {
      // Fallback: escape HTML
      return content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }
  }, [content, language])

  return (
    <div id="viewer-container" className="h-full overflow-auto bg-gray-900">
      <pre className="p-6 text-sm font-mono leading-relaxed overflow-x-auto">
        <code className={`language-${language || 'plaintext'}`} dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      </pre>
    </div>
  )
}

export default function MarkdownViewer({ content, mode, currentFilePath, onFileLinkClick }: MarkdownViewerProps) {
  const isMd = isMarkdownFile(currentFilePath)

  useEffect(() => {
    const container = document.getElementById('viewer-container')
    if (container) {
      container.scrollTop = 0
    }
  }, [content])

  const handlePathClick = async (relativePath: string) => {
    if (!currentFilePath) return
    const cleanPath = relativePath.replace(/#[\w-]*$/, '').replace(/\?[\w=&]*$/, '')
    const resolved = await window.electronAPI.resolveFilePath(currentFilePath, cleanPath)
    if (resolved) {
      onFileLinkClick(resolved)
    }
  }

  // For non-markdown files, always show source code view (no preview mode)
  if (!isMd) {
    return <SourceCodeViewer content={content} filePath={currentFilePath} />
  }

  // Markdown raw text mode
  if (mode === 'markdown') {
    return (
      <div id="viewer-container" className="h-full overflow-auto bg-gray-50">
        <pre className="p-6 text-sm font-mono leading-relaxed text-gray-800 whitespace-pre-wrap break-words">
          {content}
        </pre>
      </div>
    )
  }

  // Markdown preview mode
  return (
    <div id="viewer-container" className="h-full overflow-auto bg-white">
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
