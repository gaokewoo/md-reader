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

interface Workspace {
  path: string
  name: string
  tree: FNode[]
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

// Check if a file path belongs to any workspace
function isFileInWorkspace(filePath: string, workspacePath: string): boolean {
  return filePath.startsWith(workspacePath + '/')
}

export default function App() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [tabs, setTabs] = useState<TabInfo[]>([])
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const workspacesRef = useRef<Workspace[]>([])
  workspacesRef.current = workspaces

  // Helper: get active tab
  const activeTab = tabs.find(t => t.path === activeTabPath) || null

  // Add a workspace (if not already present)
  const addWorkspace = useCallback(async (dir: string) => {
    // Check if already exists
    if (workspacesRef.current.some(w => w.path === dir)) return true
    try {
      const r = await window.electronAPI.readFolder(dir)
      if (r.ok && r.tree) {
        const name = dir.split('/').pop() || dir
        setWorkspaces(prev => [...prev, { path: dir, name, tree: r.tree! }])
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  // Remove a workspace and close its tabs
  const removeWorkspace = useCallback((dir: string) => {
    setWorkspaces(prev => prev.filter(w => w.path !== dir))
    // Close tabs that belong to this workspace
    setTabs(prev => {
      const remaining = prev.filter(t => !isFileInWorkspace(t.path, dir))
      // If the active tab was closed, switch to the first remaining tab
      const activeStillExists = remaining.some(t => t.path === activeTabPath)
      if (!activeStillExists) {
        setActiveTabPath(remaining.length > 0 ? remaining[0].path : null)
      }
      return remaining
    })
  }, [activeTabPath])

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
      setLoading(true)
      setError(null)
      try {
        const success = await addWorkspace(dir)
        if (!success) {
          setError('读取文件夹失败')
        }
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    })
    return off
  }, [addWorkspace])

  useEffect(() => {
    const off = window.electronAPI.onMenuOpenFile(async (fp: string) => {
      // Add parent directory as workspace if not already present
      const parent = fp.substring(0, fp.lastIndexOf('/'))
      if (parent) {
        await addWorkspace(parent)
      }
      // Open file as tab
      await openFileTab(fp)
    })
    return off
  }, [addWorkspace, openFileTab])

  // ---- Toolbar: open folder ----

  const handleToolbarOpen = useCallback(async () => {
    const p = await window.electronAPI.selectFolder()
    if (!p) return
    setLoading(true)
    setError(null)
    try {
      const success = await addWorkspace(p)
      if (!success) {
        setError('读取文件夹失败')
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [addWorkspace])

  // ---- File tree click ----

  const handleTreeSelect = useCallback(async (p: string, type: string) => {
    if (type !== 'file') return
    await openFileTab(p)
  }, [openFileTab])

  // ---- File link click from markdown ----

  const handleFileLinkClick = useCallback(async (filePath: string) => {
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
          <div className="flex-1 overflow-auto">
            {workspaces.length > 0 ? (
              workspaces.map((ws) => (
                <div key={ws.path} className="border-b border-gray-200 last:border-b-0">
                  {/* Workspace header */}
                  <div className="flex items-center px-2 py-1.5 bg-gray-100 border-b border-gray-200 group">
                    <svg className="w-3.5 h-3.5 text-yellow-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    </svg>
                    <span className="text-xs font-medium text-gray-600 truncate flex-1" title={ws.path}>
                      {ws.name}
                    </span>
                    <button
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeWorkspace(ws.path)}
                      title="移除文件夹"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {/* Workspace file tree */}
                  <FileTree nodes={ws.tree} selectedPath={activeTabPath} onSelect={handleTreeSelect} />
                </div>
              ))
            ) : loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 px-6">
                <svg className="w-10 h-10 mb-2 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-red-400 text-center">{error}</p>
              </div>
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
