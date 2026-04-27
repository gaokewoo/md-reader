import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron'
import path from 'path'
import fs from 'fs'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

function ensureWin(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow
  const e = BrowserWindow.getAllWindows().find(w => !w.isDestroyed())
  if (e) { mainWindow = e; return e }
  createWindow()
  return mainWindow!
}

function buildMenu() {
  const tpl: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Folder...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed())
            if (!win) return
            const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
            console.log('[main] Open Folder dialog result:', JSON.stringify(r))
            if (!r.canceled && r.filePaths[0]) {
              console.log('[main] Sending menu:open-folder with path:', r.filePaths[0])
              if (!win.webContents.isDestroyed()) {
                win.webContents.send('menu:open-folder', r.filePaths[0])
              }
            }
          },
        },
        {
          label: 'Open File...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed())
            if (!win) return
            const r = await dialog.showOpenDialog(win, {
              properties: ['openFile'],
              filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
            })
            console.log('[main] Open File dialog result:', JSON.stringify(r))
            if (!r.canceled && r.filePaths[0]) {
              console.log('[main] Sending menu:open-file with path:', r.filePaths[0])
              if (!win.webContents.isDestroyed()) {
                win.webContents.send('menu:open-file', r.filePaths[0])
              }
            }
          },
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl))
}

app.whenReady().then(() => {
  createWindow()
  buildMenu()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

// ---- IPC handlers (same ones the toolbar buttons use) ----

ipcMain.handle('select-folder', async () => {
  const r = await dialog.showOpenDialog(ensureWin(), { properties: ['openDirectory'] })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('select-file', async () => {
  const r = await dialog.showOpenDialog(ensureWin(), {
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('read-folder', async (_, dir: string) => {
  try {
    const tree = scanDir(dir)
    console.log('[main] read-folder result for', dir, '- tree items:', tree.length)
    return { ok: true, tree, path: dir }
  } catch (e: unknown) { return { ok: false, error: String(e) } }
})

ipcMain.handle('read-file', async (_, fp: string) => {
  try {
    const content = fs.readFileSync(fp, 'utf8')
    console.log('[main] read-file result for', fp, '- length:', content.length)
    return { ok: true, content }
  } catch (e: unknown) { return { ok: false, error: String(e) } }
})

// ---- scanner ----

interface FNode { name: string; path: string; type: 'file' | 'directory'; children?: FNode[] }

function scanDir(dir: string): FNode[] {
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) }
  catch { return [] } // 权限不足等错误，跳过该目录

  const out: FNode[] = []
  for (const f of entries) {
    if (f.name.startsWith('.')) continue
    const full = path.join(dir, f.name)
    if (f.isDirectory()) {
      out.push({ name: f.name, path: full, type: 'directory', children: scanDir(full) })
    } else if (/\.(md|markdown)$/i.test(f.name)) {
      out.push({ name: f.name, path: full, type: 'file' })
    }
  }
  out.sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1)
  return out
}
