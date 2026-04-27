/// <reference types="vite/client" />

interface FNode { name: string; path: string; type: 'file' | 'directory'; children?: FNode[] }

interface Window {
  electronAPI: {
    selectFolder: () => Promise<string | null>
    selectFile:   () => Promise<string | null>
    readFolder:   (p: string) => Promise<{ ok?: boolean; tree?: FNode[]; path?: string; error?: string }>
    readFile:     (p: string) => Promise<{ ok?: boolean; content?: string; error?: string }>
    onMenuOpenFolder: (fn: (path: string) => void) => () => void
    onMenuOpenFile:   (fn: (path: string) => void) => () => void
  }
}
