import { useState, useCallback, useEffect, useRef } from 'react'
import FileTree from './components/FileTree'
import MarkdownViewer from './components/MarkdownViewer'
import TabBar from './components/TabBar'

type ViewMode = 'preview' | 'markdown'

interface TabInfo {
  path: string
  name: string
  content: string
  viewMode: ViewMode
}

function isMarkdownFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  return ext === 'md' || ext === 'markdown'
}

function getFileLanguageLabel(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const labels: Record<string, string> = {
    js: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', tsx: 'TSX',
    py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust', java: 'Java',
    c: 'C', cpp: 'C++', h: 'C Header', hpp: 'C++ Header',
    cs: 'C#', swift: 'Swift', kt: 'Kotlin', scala: 'Scala',
    html: 'HTML', css: 'CSS', scss: 'SCSS', less: 'LESS', vue: 'Vue', svelte: 'Svelte',
    json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML', xml: 'XML',
    sql: 'SQL', sh: 'Shell', bash: 'Bash', zsh: 'Zsh',
    md: 'Markdown', markdown: 'Markdown', txt: 'Text', log: 'Log',
    dockerfile: 'Dockerfile', makefile: 'Makefile',
  }
  return labels[ext] || ext.toUpperCase()
}

export default function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<Array<any>>([])
  const [tabs, setTabs] = useState<TabInfo[]>([])
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const folderPathRef = useRef<string | null>(null)
  folderPathRef.current = folderPath

  // Helper: get active tab
  const activeTab = tabs.find(t => t.path === activeTabPath) || null

  // Open a file as a new tab (or switch to existing tab if already open)
  const openFileTab = useCallback(async (filePath: string) => {
    // If tab already exists, just switch to it
    const existing = tabs.find(t => t.path === filePath)
    if (existing) {
      setActiveTabPath(filePath)
      return
    }

    // Read the file and add as new tab
    setLoading(true)
    setError(null)
    try {
      const r = await window.electronAPI.readFile(filePath)
      if (r.ok && r.content !== undefined) {
        const name = filePath.split('/').pop() || filePath
        const defaultMode = isMarkdownFile(filePath) ? 'preview' : 'markdown'
        const newTab: TabInfo = { path: filePath, name, content: r.content, viewMode: defaultMode }
        setTabs(prev => [...prev, newTab])
        setActiveTabPath(filePath)
      } else {
        setError(r.error ?? '读取文件失败')
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [tabs])

  // Close a tab
  const closeTab = useCallback((path: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.path === path)
      const next = prev.filter(t => t.path !== path)
      // If closing the active tab, switch to the nearest tab
      if (path === activeTabPath) {
        if (next.length === 0) {
          setActiveTabPath(null)
        } else if (idx > 0) {
          setActiveTabPath(next[idx - 1]?.path ?? next[0].path)
        } else {
          setActiveTabPath(next[0].path)
        }
      }
      return next
    })
  }, [activeTabPath])

  // Close all tabs except the specified one
  const closeOtherTabs = useCallback((path: string) => {
    setTabs(prev => prev.filter(t => t.path === path))
    setActiveTabPath(path)
  }, [])

  // Update tab view mode
  const setTabViewMode = useCallback((path: string, mode: ViewMode) => {
    setTabs(prev => prev.map(t => t.path === path ? { ...t, viewMode: mode } : t))
  }, [])

  // ---- Menu events ----

  useEffect(() => {
    const off = window.electronAPI.onMenuOpenFolder(async (dir: string) => {
      setFolderPath(dir)
      setTabs([])
      setActiveTabPath(null)
      setError(null)
      setLoading(true)
      try {
        const r = await window.electronAPI.readFolder(dir)
        if (r.ok && r.tree) {
          setFileTree(r.tree)
        } else {
          setError(r.error ?? '读取文件夹失败')
          setFileTree([])
        }
      } catch (e) {
        setError(String(e))
        setFileTree([])
      } finally {
        setLoading(false)
      }
    })
    return off
  }, [])

  useEffect(() => {
    const off = window.electronAPI.onMenuOpenFile(async (fp: string) => {
      // Load parent directory tree if needed
      const parent = fp.substring(0, fp.lastIndexOf('/'))
      if (parent && parent !== folderPathRef.current) {
        setFolderPath(parent)
        try {
          const r = await window.electronAPI.readFolder(parent)
          if (r.ok && r.tree) setFileTree(r.tree)
          else setFileTree([])
        } catch { setFileTree([]) }
      }
      // Open file as tab
      await openFileTab(fp)
    })
    return off
  }, [openFileTab])

  // ---- Toolbar: open folder ----

  const handleToolbarOpen = useCallback(async () => {
    const p = await window.electronAPI.selectFolder()
    if (!p) return
    setFolderPath(p)
    setTabs([])
    setActiveTabPath(null)
    setError(null)
    setLoading(true)
    try {
      const r = await window.electronAPI.readFolder(p)
      if (r.ok && r.tree) setFileTree(r.tree)
      else { setError(r.error ?? '读取文件夹失败'); setFileTree([]) }
    } catch (e) {
      setError(String(e))
      setFileTree([])
    } finally {
      setLoading(false)
    }
  }, [])

  // ---- File tree click ----

  const handleTreeSelect = useCallback(async (p: string, type: string) => {
    if (type !== 'file') return
    await openFileTab(p)
  }, [openFileTab])

  // ---- File link click from markdown ----

  const handleFileLinkClick = useCallback(async (filePath: string) => {
    // If the file's parent directory is different, update the folder tree
    const parent = filePath.substring(0, filePath.lastIndexOf('/'))
    if (parent && parent !== folderPathRef.current) {
      setFolderPath(parent)
      try {
        const r = await window.electronAPI.readFolder(parent)
        if (r.ok && r.tree) setFileTree(r.tree)
      } catch { /* ignore */ }
    }
    await openFileTab(filePath)
  }, [openFileTab])

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Title bar */}
      <div className="h-12 shrink-0 bg-gray-100 border-b border-gray-200 flex items-center px-4 select-none">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
            <path className="text-blue-300" d="M14 3v5h5M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
          <span className="text-sm font-semibold text-gray-700">MD Reader</span>
        </div>
        <div className="flex-1" />
        <button onClick={handleToolbarOpen}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          Open Folder
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col">
          {folderPath && (
            <div className="px-3 py-2 border-b border-gray-200 text-xs text-gray-500 truncate" title={folderPath}>
              {folderPath}
            </div>
          )}
          <div className="flex-1 overflow-auto">
            {loading && tabs.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error && fileTree.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 px-6">
                <svg className="w-10 h-10 mb-2 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-red-400 text-center">{error}</p>
              </div>
            ) : fileTree.length > 0 ? (
              <FileTree nodes={fileTree} selectedPath={activeTabPath} onSelect={handleTreeSelect} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 px-6">
                <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <p className="text-sm text-center">Use File menu or button above</p>
              </div>
            )}
          </div>
        </div>

        {/* Viewer */}
        <div className="flex-1 flex flex-col bg-white">
          {activeTab ? (
            <>
              {/* Tab bar */}
              <TabBar
                tabs={tabs.map(t => ({ path: t.path, name: t.name }))}
                activePath={activeTabPath}
                onSelect={setActiveTabPath}
                onClose={closeTab}
                onCloseOthers={closeOtherTabs}
              />
              {/* Viewer header */}
              <div className="h-10 shrink-0 border-b border-gray-200 flex items-center justify-between px-4 bg-gray-50">
                <div className="flex items-center gap-2">
                  <svg className={`w-4 h-4 flex-shrink-0 ${isMarkdownFile(activeTab.path) ? 'text-blue-500' : 'text-gray-500'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700 truncate max-w-md">{activeTab.name}</span>
                </div>
                {isMarkdownFile(activeTab.path) ? (
                  <div className="flex bg-gray-200 rounded-lg p-0.5">
                    {['preview', 'markdown'].map(m => (
                      <button key={m} onClick={() => setTabViewMode(activeTabPath!, m as ViewMode)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${activeTab.viewMode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                        {m[0].toUpperCase() + m.slice(1)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="px-2.5 py-1 text-xs font-medium text-gray-500 bg-gray-200 rounded-md">
                    {getFileLanguageLabel(activeTab.path)}
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
                ) : error ? (
                  <div className="flex items-center justify-center h-full p-8">
                    <p className="text-red-500 text-sm text-center">{error}</p>
                  </div>
                ) : (
                  <MarkdownViewer
                    content={activeTab.content}
                    mode={activeTab.viewMode}
                    currentFilePath={activeTab.path}
                    onFileLinkClick={handleFileLinkClick}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Select a file to start reading</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
