import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface TerminalPanelProps {
  visible: boolean
  cwd?: string
}

export default function TerminalPanel({ visible, cwd }: TerminalPanelProps) {
  const termRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  // Spawn / kill PTY whenever visibility changes
  useEffect(() => {
    if (!visible || !termRef.current) return

    // If terminal already exists, just fit and return
    if (terminalRef.current) {
      const timer = setTimeout(() => {
        try { fitAddonRef.current?.fit() } catch { /* ignore */ }
      }, 50)
      return () => clearTimeout(timer)
    }

    // Create new terminal
    const term = new Terminal({
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
      },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(termRef.current)

    try { fitAddon.fit() } catch { /* ignore */ }

    terminalRef.current = term
    fitAddonRef.current = fitAddon

    // Spawn PTY via IPC
    window.electronAPI.ptySpawn(cwd || undefined, term.cols, term.rows)

    // Send terminal data to PTY
    const onDataDispose = term.onData((data: string) => {
      window.electronAPI.ptyWrite(data)
    })

    // Receive PTY data
    const offPtyData = window.electronAPI.onPtyData((data: string) => {
      term.write(data)
    })

    // Handle resize
    const onResizeDispose = term.onResize(({ cols: c, rows: r }) => {
      window.electronAPI.ptyResize(c, r)
    })

    return () => {
      onDataDispose.dispose()
      onResizeDispose.dispose()
      offPtyData()
    }
  }, [visible, cwd])

  // Cleanup terminal when hidden
  useEffect(() => {
    if (!visible) {
      // Kill PTY
      window.electronAPI.ptyKill()
      // Dispose terminal
      if (terminalRef.current) {
        terminalRef.current.dispose()
        terminalRef.current = null
        fitAddonRef.current = null
      }
    }
  }, [visible])

  if (!visible) return null

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      <div ref={termRef} className="flex-1 px-1 py-0.5 overflow-hidden" style={{ minHeight: 0 }} />
    </div>
  )
}
