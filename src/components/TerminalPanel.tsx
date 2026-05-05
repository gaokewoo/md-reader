import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface TerminalPanelProps {
  /** Whether the terminal panel is visible */
  visible: boolean
  /** Working directory for the shell */
  cwd?: string
}

/**
 * TerminalPanel — Embedded terminal using xterm.js + node-pty
 *
 * KEY DESIGN: This component is only mounted when the panel is first opened
 * (controlled by `bottomPanelEverOpened` in App.tsx). When hidden, the parent
 * uses `visibility:hidden` + `height:0` instead of `display:none`, so the
 * xterm.js terminal always retains correct dimensions.
 *
 * This avoids the "cols=2" bug where xterm opens in a 0-width container.
 */
export default function TerminalPanel({ visible, cwd }: TerminalPanelProps) {
  const termRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const ptySpawnedRef = useRef(false)
  const isDisposedRef = useRef(false)

  // IPC listener cleanup
  const ptyDataCleanupRef = useRef<(() => void) | null>(null)

  // ---- Create xterm.js + spawn PTY on mount ----
  // Since this component only mounts when the panel is first opened,
  // the container has real dimensions, so fit() returns correct cols/rows.
  useEffect(() => {
    if (!termRef.current || terminalRef.current) return

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

    terminalRef.current = term
    fitAddonRef.current = fitAddon

    // Fit to get real dimensions
    try { fitAddon.fit() } catch { /* ignore */ }

    let cols = term.cols || 80
    let rows = term.rows || 24
    if (cols < 10) cols = 120
    if (rows < 5) rows = 15

    console.log(`[TerminalPanel] xterm created: ${term.cols}x${term.rows}, spawning PTY: ${cols}x${rows}`)

    // Spawn PTY immediately — we have real dimensions now
    window.electronAPI.ptySpawn(cwd || undefined, cols, rows).then(() => {
      if (isDisposedRef.current) return
      ptySpawnedRef.current = true

      // Keyboard input → PTY
      const onDataDispose = term.onData((data: string) => {
        window.electronAPI.ptyWrite(data)
      })

      // PTY output → terminal
      const offPtyData = window.electronAPI.onPtyData((data: string) => {
        if (!isDisposedRef.current && terminalRef.current) {
          terminalRef.current.write(data)
        }
      })

      // PTY exit
      const offPtyExit = window.electronAPI.onPtyExit((_code: number) => {
        ptySpawnedRef.current = false
        if (!isDisposedRef.current && terminalRef.current) {
          terminalRef.current.writeln('\r\n\x1b[90m[Process exited]\x1b[0m')
        }
      })

      // Terminal resize → PTY resize
      const onResizeDispose = term.onResize(({ cols: c, rows: r }) => {
        window.electronAPI.ptyResize(c, r)
      })

      ptyDataCleanupRef.current = () => {
        onDataDispose.dispose()
        onResizeDispose.dispose()
        offPtyData()
        offPtyExit()
      }
    }).catch((e) => {
      console.error('[TerminalPanel] Failed to spawn PTY:', e)
      if (!isDisposedRef.current && terminalRef.current) {
        terminalRef.current.writeln('\r\n\x1b[31m[Failed to start terminal: ' + String(e) + ']\x1b[0m')
      }
    })

    // Cleanup on unmount
    return () => {
      isDisposedRef.current = true
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }
      if (terminalRef.current) {
        try { terminalRef.current.dispose() } catch { /* ignore */ }
        terminalRef.current = null
        fitAddonRef.current = null
      }
      if (ptySpawnedRef.current) {
        window.electronAPI.ptyKill()
        ptySpawnedRef.current = false
      }
      if (ptyDataCleanupRef.current) { ptyDataCleanupRef.current(); ptyDataCleanupRef.current = null }
    }
  }, []) // Mount once

  // ---- Re-spawn PTY if cwd changes ----
  useEffect(() => {
    if (!ptySpawnedRef.current || !terminalRef.current) return
    // Kill existing PTY and re-spawn with new cwd
    window.electronAPI.ptyKill()
    if (ptyDataCleanupRef.current) { ptyDataCleanupRef.current(); ptyDataCleanupRef.current = null }
    ptySpawnedRef.current = false

    const term = terminalRef.current
    let cols = term.cols || 80
    let rows = term.rows || 24

    window.electronAPI.ptySpawn(cwd || undefined, cols, rows).then(() => {
      if (isDisposedRef.current) return
      ptySpawnedRef.current = true

      const onDataDispose = term.onData((data: string) => { window.electronAPI.ptyWrite(data) })
      const offPtyData = window.electronAPI.onPtyData((data: string) => {
        if (!isDisposedRef.current && terminalRef.current) terminalRef.current.write(data)
      })
      const offPtyExit = window.electronAPI.onPtyExit((_code: number) => {
        ptySpawnedRef.current = false
        if (!isDisposedRef.current && terminalRef.current) {
          terminalRef.current.writeln('\r\n\x1b[90m[Process exited]\x1b[0m')
        }
      })
      const onResizeDispose = term.onResize(({ cols: c, rows: r }) => { window.electronAPI.ptyResize(c, r) })

      ptyDataCleanupRef.current = () => {
        onDataDispose.dispose()
        onResizeDispose.dispose()
        offPtyData()
        offPtyExit()
      }
    }).catch((e) => {
      console.error('[TerminalPanel] Failed to re-spawn PTY:', e)
    })
  }, [cwd])

  // ---- ResizeObserver for automatic fit + ptyResize ----
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        try {
          if (fitAddonRef.current && terminalRef.current && !isDisposedRef.current) {
            fitAddonRef.current.fit()
            if (ptySpawnedRef.current) {
              window.electronAPI.ptyResize(terminalRef.current.cols, terminalRef.current.rows)
            }
          }
        } catch { /* ignore */ }
      })
    })

    observer.observe(containerRef.current)
    resizeObserverRef.current = observer

    return () => { observer.disconnect() }
  }, [])

  // ---- Refit + focus when visibility toggles ----
  useEffect(() => {
    if (!visible || !terminalRef.current) return

    requestAnimationFrame(() => {
      try {
        if (fitAddonRef.current && terminalRef.current && !isDisposedRef.current) {
          fitAddonRef.current.fit()
          if (ptySpawnedRef.current) {
            window.electronAPI.ptyResize(terminalRef.current.cols, terminalRef.current.rows)
          }
        }
      } catch { /* ignore */ }
      setTimeout(() => {
        if (!isDisposedRef.current && terminalRef.current) {
          terminalRef.current.focus()
        }
      }, 100)
    })
  }, [visible])

  return (
    <div
      ref={containerRef}
      className="h-full flex flex-col bg-[#1e1e1e]"
      style={{ flexDirection: 'column', overflow: 'hidden' }}
    >
      <div
        ref={termRef}
        className="flex-1 px-1 py-0.5"
        style={{ minHeight: 0, overflow: 'hidden' }}
      />
    </div>
  )
}
