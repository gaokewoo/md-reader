import { useState, useRef, useEffect, useCallback } from 'react'

interface TabData {
  path: string
  name: string
}

interface TabBarProps {
  tabs: TabData[]
  activePath: string | null
  onSelect: (path: string) => void
  onClose: (path: string) => void
  onCloseOthers: (path: string) => void
}

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  path: string | null
}

export default function TabBar({ tabs, activePath, onSelect, onClose, onCloseOthers }: TabBarProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, path: null })
  const menuRef = useRef<HTMLDivElement>(null)

  const handleContextMenu = useCallback((e: React.MouseEvent, path: string) => {
    e.preventDefault()
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, path })
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0, path: null })
  }, [])

  useEffect(() => {
    const handleClick = () => closeContextMenu()
    if (contextMenu.visible) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenu.visible, closeContextMenu])

  if (tabs.length === 0) return null

  return (
    <div className="flex items-center bg-gray-100 border-b border-gray-200 overflow-x-auto shrink-0" style={{ minHeight: 36 }}>
      {tabs.map((tab) => {
        const isActive = tab.path === activePath
        return (
          <div
            key={tab.path}
            className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-gray-200 select-none whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-white text-gray-900 font-medium border-b-2 border-b-blue-500'
                : 'text-gray-600 hover:bg-gray-50 border-b-2 border-b-transparent'
            }`}
            onClick={() => onSelect(tab.path)}
            onContextMenu={(e) => handleContextMenu(e, tab.path)}
          >
            <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
            <span className="truncate max-w-[140px]">{tab.name}</span>
            {isActive && (
              <button
                className="ml-1 w-4 h-4 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(tab.path)
                }}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )
      })}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            onClick={() => {
              if (contextMenu.path) onClose(contextMenu.path)
              closeContextMenu()
            }}
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            关闭
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            onClick={() => {
              if (contextMenu.path) onCloseOthers(contextMenu.path)
              closeContextMenu()
            }}
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            关闭其他
          </button>
        </div>
      )}
    </div>
  )
}
