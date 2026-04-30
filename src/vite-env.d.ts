/// <reference types="vite/client" />

interface FNode { name: string; path: string; type: 'file' | 'directory'; children?: FNode[] }

interface TabInfo {
  path: string
  name: string
  content: string
  viewMode: 'preview' | 'markdown'
  scrollPosition?: number
}

interface Window {
  electronAPI: {
    selectFolder: () => Promise<string | null>
    selectFile:   () => Promise<string | null>
    readFolder:   (p: string) => Promise<{ ok?: boolean; tree?: FNode[]; path?: string; error?: string }>
    readFile:     (p: string) => Promise<{ ok?: boolean; content?: string; error?: string }>
    checkFileExists: (p: string) => Promise<boolean>
    resolveFilePath: (basePath: string, relativePath: string) => Promise<string | null>
    onMenuOpenFolder: (fn: (path: string) => void) => () => void
    onMenuOpenFile:   (fn: (path: string) => void) => () => void
    onMenuFind:       (fn: () => void) => () => void
    // PTY (Terminal)
    ptySpawn:  (cwd?: string, cols?: number, rows?: number) => Promise<void>
    ptyWrite:  (data: string) => Promise<void>
    ptyResize: (cols: number, rows: number) => Promise<void>
    ptyKill:   () => Promise<void>
    onPtyData: (fn: (data: string) => void) => () => void
    onPtyExit: (fn: (exitCode: number) => void) => () => void
  }
}
