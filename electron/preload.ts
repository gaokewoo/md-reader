import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFile:   () => ipcRenderer.invoke('select-file'),
  readFolder:   (p: string) => ipcRenderer.invoke('read-folder', p),
  readFile:     (p: string) => ipcRenderer.invoke('read-file', p),

  onMenuOpenFolder: (fn: (path: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, path: string) => fn(path)
    ipcRenderer.on('menu:open-folder', handler)
    return () => { ipcRenderer.removeListener('menu:open-folder', handler) }
  },
  onMenuOpenFile: (fn: (path: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, path: string) => fn(path)
    ipcRenderer.on('menu:open-file', handler)
    return () => { ipcRenderer.removeListener('menu:open-file', handler) }
  },
})
