import { useState, useCallback, useEffect, useRef } from 'react'
import FileTree from './components/FileTree'
import MarkdownViewer from './components/MarkdownViewer'
import TabBar from './components/TabBar'
import SearchBar from './components/SearchBar'
import TocPanel from './components/TocPanel'
import TerminalPanel from './components/TerminalPanel'

type ViewMode = 'preview' | 'markdown'

interface TabInfo {
  path: string
  name: string
  content: string
  viewMode: ViewMode
  scrollTop: number
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

function isFileInWorkspace(filePath: string, workspacePath: string): boolean {
  return filePath.startsWith(workspacePath + '/')
}

export default function App() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [tabs, setTabs] = useState<TabInfo[]>([])
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchVisible, setSearchVisible] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1)
  const [collapsedWorkspaces, setCollapsedWorkspaces] = useState<Set<string>>(new Set())

  // Panel visibility & sizes
  const [leftPanelVisible, setLeftPanelVisible] = useState(true)
  const [rightPanelVisible, setRightPanelVisible] = useState(false)
  const [bottomPanelVisible, setBottomPanelVisible] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(288)
  const [bottomPanelHeight, setBottomPanelHeight] = useState(220)

  const workspacesRef = useRef<Workspace[]>([])
  workspacesRef.current = workspaces

  const tabsRef = useRef<TabInfo[]>([])
  tabsRef.current = tabs

  const isDragging = useRef(false)

  const activeTab = tabs.find(t => t.path === activeTabPath) || null

  // ---- Search logic ----

  const handleSearchKeywordChange = useCallback((keyword: string) => {
    setSearchKeyword(keyword)
    setCurrentMatchIndex(keyword ? 0 : -1)
  }, [])

  const handleMatchCountChange = useCallback((count: number) => {
    setMatchCount(count)
    if (count === 0) {
      setCurrentMatchIndex(-1)
    } else if (currentMatchIndex < 0) {
      setCurrentMatchIndex(0)
    }
  }, [currentMatchIndex])

  const handleSearchPrev = useCallback(() => {
    if (matchCount === 0) return
    setCurrentMatchIndex(prev => prev <= 0 ? matchCount - 1 : prev - 1)
  }, [matchCount])

  const handleSearchNext = useCallback(() => {
    if (matchCount === 0) return
    setCurrentMatchIndex(prev => prev >= matchCount - 1 ? 0 : prev + 1)
  }, [matchCount])

  // ---- Menu Find event ----

  useEffect(() => {
    const off = window.electronAPI.onMenuFind(() => {
      setSearchVisible(true)
    })
    return off
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setSearchVisible(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Reset search when tab changes
  useEffect(() => {
    setMatchCount(0)
    setCurrentMatchIndex(searchKeyword ? 0 : -1)
  }, [activeTabPath, searchKeyword])

  // Save/Restore scroll position when switching tabs
  const prevActiveTabPathRef = useRef<string | null>(null)
  useEffect(() => {
    const prevPath = prevActiveTabPathRef.current
    prevActiveTabPathRef.current = activeTabPath

    // Save scroll position of the previous tab
    if (prevPath) {
      const container = document.getElementById('viewer-container')
      if (container) {
        const scrollTop = container.scrollTop
        setTabs(prev => prev.map(t => t.path === prevPath ? { ...t, scrollTop } : t))
      }
    }

    // Restore scroll position of the new tab (after DOM renders)
    if (activeTabPath) {
      const targetTab = tabsRef.current.find(t => t.path === activeTabPath)
      if (targetTab && targetTab.scrollTop > 0) {
        requestAnimationFrame(() => {
          const container = document.getElementById('viewer-container')
          if (container) {
            container.scrollTop = targetTab.scrollTop
          }
        })
      }
    }
  }, [activeTabPath])

  // ---- Add/remove workspace ----

  const addWorkspace = useCallback(async (dir: string) => {
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

  const removeWorkspace = useCallback((dir: string) => {
    setWorkspaces(prev => prev.filter(w => w.path !== dir))
    setTabs(prev => {
      const remaining = prev.filter(t => !isFileInWorkspace(t.path, dir))
      const activeStillExists = remaining.some(t => t.path === activeTabPath)
      if (!activeStillExists) {
        setActiveTabPath(remaining.length > 0 ? remaining[0].path : null)
      }
      return remaining
    })
  }, [activeTabPath])

  // ---- File tab management ----

  const openFileTab = useCallback(async (filePath: string) => {
    const existing = tabs.find(t => t.path === filePath)
    if (existing) {
      setActiveTabPath(filePath)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const r = await window.electronAPI.readFile(filePath)
      if (r.ok && r.content !== undefined) {
        const name = filePath.split('/').pop() || filePath
        const defaultMode = isMarkdownFile(filePath) ? 'preview' : 'markdown'
        const newTab: TabInfo = { path: filePath, name, content: r.content, viewMode: defaultMode, scrollTop: 0 }
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

  const closeOtherTabs = useCallback((path: string) => {
    setTabs(prev => prev.filter(t => t.path === path))
    setActiveTabPath(path)
  }, [])

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
        if (!success) setError('读取文件夹失败')
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
      const parent = fp.substring(0, fp.lastIndexOf('/'))
      if (parent) await addWorkspace(parent)
      await openFileTab(fp)
    })
    return off
  }, [addWorkspace, openFileTab])

  // ---- Toolbar ----

  const handleToolbarOpen = useCallback(async () => {
    const p = await window.electronAPI.selectFolder()
    if (!p) return
    setLoading(true)
    setError(null)
    try {
      const success = await addWorkspace(p)
      if (!success) setError('读取文件夹失败')
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [addWorkspace])

  // ---- File tree / link click ----

  const handleTreeSelect = useCallback(async (p: string, type: string) => {
    if (type !== 'file') return
    await openFileTab(p)
  }, [openFileTab])

  const handleFileLinkClick = useCallback(async (filePath: string) => {
    await openFileTab(filePath)
  }, [openFileTab])

  // ---- Workspace collapse ----

  const toggleWorkspaceCollapse = useCallback((path: string) => {
    setCollapsedWorkspaces(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  // ---- TOC heading click ----

  const handleHeadingClick = useCallback((id: string) => {
    const container = document.getElementById('viewer-container')
    if (!container) return
    const el = container.querySelector(`#${CSS.escape(id)}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // ---- Panel resize (left sidebar) ----

  const handleLeftResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    const startX = e.clientX
    const startWidth = sidebarWidth

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const diff = ev.clientX - startX
      setSidebarWidth(Math.max(180, Math.min(600, startWidth + diff)))
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [sidebarWidth])

  // ---- Panel resize (bottom panel) ----

  const handleBottomResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    const startY = e.clientY
    const startHeight = bottomPanelHeight

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const diff = startY - ev.clientY
      setBottomPanelHeight(Math.max(120, Math.min(500, startHeight + diff)))
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [bottomPanelHeight])

  // ---- Get terminal CWD from first workspace ----

  const terminalCwd = workspaces.length > 0 ? workspaces[0].path : undefined

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Title bar */}
      <div className="shrink-0 bg-gray-100 border-b border-gray-200 flex items-center px-4 select-none" style={{ height: 40 }}>
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
            <path className="text-blue-300" d="M14 3v5h5M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
          <span className="text-sm font-semibold text-gray-700">MD Reader</span>
        </div>

        <div className="flex-1" />

        {/* Panel toggle buttons */}
        <div className="flex items-center gap-1 mr-1">
          {/* Left sidebar toggle — left panel open */}
          <button
            onClick={() => setLeftPanelVisible(!leftPanelVisible)}
            className={`p-1 rounded transition-colors ${leftPanelVisible ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
            title="切换左侧面板"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="14" height="14" rx="2" />
              <line x1="5.5" y1="1" x2="5.5" y2="15" />
            </svg>
          </button>
          {/* Bottom panel toggle — bottom panel open */}
          <button
            onClick={() => setBottomPanelVisible(!bottomPanelVisible)}
            className={`p-1 rounded transition-colors ${bottomPanelVisible ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
            title="切换底部面板"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="14" height="14" rx="2" />
              <line x1="1" y1="10.5" x2="15" y2="10.5" />
            </svg>
          </button>
          {/* Right sidebar toggle — right panel open */}
          <button
            onClick={() => setRightPanelVisible(!rightPanelVisible)}
            className={`p-1 rounded transition-colors ${rightPanelVisible ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
            title="切换右侧面板"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="14" height="14" rx="2" />
              <line x1="10.5" y1="1" x2="10.5" y2="15" />
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-300 mx-1" />

        {/* Search button */}
        <button
          onClick={() => setSearchVisible(!searchVisible)}
          className={`flex items-center gap-1 px-2 py-1 rounded transition-colors text-xs ${searchVisible ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
          title="查找 (Cmd+F)"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>

        {/* View mode switch (only for markdown files) */}
        {activeTab && isMarkdownFile(activeTab.path) && (
          <div className="flex bg-gray-200 rounded-lg p-0.5 ml-1">
            {['preview', 'markdown'].map(m => (
              <button key={m} onClick={() => setTabViewMode(activeTabPath!, m as ViewMode)}
                className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors ${activeTab.viewMode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                {m[0].toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Language label for non-md files */}
        {activeTab && !isMarkdownFile(activeTab.path) && (
          <span className="ml-1 px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-200 rounded-md">
            {getFileLanguageLabel(activeTab.path)}
          </span>
        )}

        {/* Divider */}
        <div className="w-px h-5 bg-gray-300 mx-2" />

        {/* Open Folder button */}
        <button onClick={handleToolbarOpen}
          className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          Open Folder
        </button>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        {leftPanelVisible && (
          <>
            <div
              className="shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col"
              style={{ width: sidebarWidth }}
            >
              <div className="flex-1 overflow-auto">
                {workspaces.length > 0 ? (
                  workspaces.map((ws) => (
                    <FileTree
                      key={ws.path}
                      nodes={ws.tree}
                      selectedPath={activeTabPath}
                      onSelect={handleTreeSelect}
                      collapsed={collapsedWorkspaces.has(ws.path)}
                      onToggleCollapse={() => toggleWorkspaceCollapse(ws.path)}
                      workspaceName={ws.name}
                      workspacePath={ws.path}
                      onRemoveWorkspace={() => removeWorkspace(ws.path)}
                    />
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
            {/* Left resize handle */}
            <div
              className="w-1 shrink-0 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 transition-colors relative"
              onMouseDown={handleLeftResizeStart}
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
            </div>
          </>
        )}

        {/* Center area (viewer + bottom panel) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Viewer + Right panel row */}
          <div className="flex-1 flex overflow-hidden">
            {/* Viewer */}
            <div className="flex-1 flex flex-col bg-white overflow-hidden">
              {activeTab ? (
                <>
                  <TabBar
                    tabs={tabs.map(t => ({ path: t.path, name: t.name }))}
                    activePath={activeTabPath}
                    onSelect={setActiveTabPath}
                    onClose={closeTab}
                    onCloseOthers={closeOtherTabs}
                  />
                  <SearchBar
                    visible={searchVisible}
                    onClose={() => { setSearchVisible(false); setSearchKeyword('') }}
                    onSearch={handleSearchKeywordChange}
                    matchCount={matchCount}
                    currentMatch={currentMatchIndex >= 0 ? currentMatchIndex + 1 : 0}
                    onPrev={handleSearchPrev}
                    onNext={handleSearchNext}
                  />
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
                        searchKeyword={searchKeyword}
                        currentMatchIndex={currentMatchIndex}
                        onMatchCountChange={handleMatchCountChange}
                        initialScrollTop={activeTab.scrollTop}
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

            {/* Right TOC panel */}
            {rightPanelVisible && activeTab && isMarkdownFile(activeTab.path) && activeTab.viewMode === 'preview' && (
              <TocPanel
                content={activeTab.content}
                visible={true}
                onHeadingClick={handleHeadingClick}
              />
            )}
          </div>

          {/* Bottom panel resize handle */}
          {bottomPanelVisible && (
            <div
              className="h-1 shrink-0 cursor-row-resize hover:bg-blue-400 active:bg-blue-500 transition-colors relative"
              onMouseDown={handleBottomResizeStart}
            >
              <div className="absolute inset-x-0 -top-1 -bottom-1" />
            </div>
          )}

          {/* Bottom terminal panel */}
          {bottomPanelVisible && (
            <div
              className="shrink-0 border-t border-gray-300 bg-[#1e1e1e]"
              style={{ height: bottomPanelHeight }}
            >
              <TerminalPanel visible={true} cwd={terminalCwd} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
