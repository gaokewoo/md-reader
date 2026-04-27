import { useState, useCallback, useEffect, useRef } from 'react'
import FileTree from './components/FileTree'
import MarkdownViewer from './components/MarkdownViewer'

type ViewMode = 'preview' | 'markdown'

export default function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<Array<any>>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 用 ref 跟踪最新 folderPath，供菜单事件回调中使用
  const folderPathRef = useRef<string | null>(null)
  folderPathRef.current = folderPath

  // ---- 菜单事件：直接在 useEffect 中处理，不经过 useCallback/useRef 间接链 ----

  useEffect(() => {
    const off = window.electronAPI.onMenuOpenFolder(async (dir: string) => {
      setFolderPath(dir)
      setSelectedFile(null)
      setContent('')
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
      setSelectedFile(fp)
      setContent('')
      setError(null)
      // 加载父目录树
      const parent = fp.substring(0, fp.lastIndexOf('/'))
      if (parent && parent !== folderPathRef.current) {
        setFolderPath(parent)
        try {
          const r = await window.electronAPI.readFolder(parent)
          if (r.ok && r.tree) setFileTree(r.tree)
          else setFileTree([])
        } catch { setFileTree([]) }
      }
      // 加载文件内容
      setLoading(true)
      try {
        const r = await window.electronAPI.readFile(fp)
        if (r.ok && r.content !== undefined) {
          setContent(r.content)
        } else {
          setError(r.error ?? '读取文件失败')
          setContent('')
        }
      } catch (e) {
        setError(String(e))
        setContent('')
      } finally {
        setLoading(false)
      }
    })
    return off
  }, [])

  // ---- 工具栏按钮：打开文件夹 ----

  const handleToolbarOpen = useCallback(async () => {
    const p = await window.electronAPI.selectFolder()
    if (!p) return
    setFolderPath(p)
    setSelectedFile(null)
    setContent('')
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

  // ---- 文件树点击 ----

  const handleTreeSelect = useCallback(async (p: string, type: string) => {
    if (type !== 'file') return
    setSelectedFile(p)
    setError(null)
    setLoading(true)
    try {
      const r = await window.electronAPI.readFile(p)
      if (r.ok && r.content !== undefined) setContent(r.content)
      else { setError(r.error ?? '读取文件失败'); setContent('') }
    } catch (e) {
      setError(String(e))
      setContent('')
    } finally {
      setLoading(false)
    }
  }, [])

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
            {loading && !content ? (
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
              <FileTree nodes={fileTree} selectedPath={selectedFile} onSelect={handleTreeSelect} />
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
          {selectedFile ? (
            <>
              <div className="h-10 shrink-0 border-b border-gray-200 flex items-center justify-between px-4 bg-gray-50">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700 truncate max-w-md">{selectedFile.split('/').pop() || selectedFile}</span>
                </div>
                <div className="flex bg-gray-200 rounded-lg p-0.5">
                  {['preview', 'markdown'].map(m => (
                    <button key={m} onClick={() => setViewMode(m as ViewMode)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                      {m[0].toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
                ) : error ? (
                  <div className="flex items-center justify-center h-full p-8">
                    <p className="text-red-500 text-sm text-center">{error}</p>
                  </div>
                ) : (
                  <MarkdownViewer content={content} mode={viewMode} />
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
