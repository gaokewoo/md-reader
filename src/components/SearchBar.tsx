import { useEffect, useRef, useState } from 'react'

interface SearchBarProps {
  visible: boolean
  onClose: () => void
  onSearch: (keyword: string) => void
  matchCount: number
  currentMatch: number
  onPrev: () => void
  onNext: () => void
}

export default function SearchBar({ visible, onClose, onSearch, matchCount, currentMatch, onPrev, onNext }: SearchBarProps) {
  const [keyword, setKeyword] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (visible) {
      inputRef.current?.focus()
    } else {
      setKeyword('')
      onSearch('')
    }
  }, [visible, onSearch])

  useEffect(() => {
    onSearch(keyword)
  }, [keyword, onSearch])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        onPrev()
      } else {
        onNext()
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!visible) return null

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 shadow-sm">
      {/* Search icon */}
      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="查找..."
        className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      />
      {/* Match count */}
      <span className="text-xs text-gray-500 whitespace-nowrap min-w-[60px] text-center">
        {keyword ? `${currentMatch}/${matchCount}` : ''}
      </span>
      {/* Prev */}
      <button
        onClick={onPrev}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 disabled:opacity-40"
        disabled={matchCount === 0}
        title="上一个 (Shift+Enter)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>
      {/* Next */}
      <button
        onClick={onNext}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 disabled:opacity-40"
        disabled={matchCount === 0}
        title="下一个 (Enter)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {/* Close */}
      <button
        onClick={onClose}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
        title="关闭 (Esc)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
