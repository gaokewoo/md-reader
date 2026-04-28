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
              filters: [
                { name: 'All Text Files', extensions: [
                  'md', 'markdown', 'txt', 'text', 'log',
                  'json', 'yaml', 'yml', 'toml', 'xml', 'csv', 'tsv',
                  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
                  'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'swift', 'kt', 'scala',
                  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
                  'html', 'htm', 'css', 'scss', 'less', 'sass', 'vue', 'svelte',
                  'sql', 'graphql', 'proto',
                  'ini', 'cfg', 'conf', 'env', 'properties',
                  'diff', 'patch', 'rst', 'adoc', 'org', 'tex',
                  'dockerfile', 'makefile', 'cmake',
                ] },
                { name: 'All Files', extensions: ['*'] },
              ],
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
    filters: [
      { name: 'All Text Files', extensions: [
        'md', 'markdown', 'txt', 'text', 'log',
        'json', 'yaml', 'yml', 'toml', 'xml', 'csv', 'tsv',
        'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
        'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'swift', 'kt', 'scala',
        'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
        'html', 'htm', 'css', 'scss', 'less', 'sass', 'vue', 'svelte',
        'sql', 'graphql', 'proto',
        'ini', 'cfg', 'conf', 'env', 'properties',
        'diff', 'patch', 'rst', 'adoc', 'org', 'tex',
        'dockerfile', 'makefile', 'cmake',
      ] },
      { name: 'All Files', extensions: ['*'] },
    ],
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

ipcMain.handle('check-file-exists', async (_, fp: string) => {
  try {
    return fs.existsSync(fp) && fs.statSync(fp).isFile()
  } catch {
    return false
  }
})

ipcMain.handle('resolve-file-path', async (_, basePath: string, relativePath: string) => {
  // Try resolving relative path from the base file's directory
  const dir = basePath.substring(0, basePath.lastIndexOf('/'))
  const resolved = path.resolve(dir, relativePath)
  try {
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return resolved
    }
  } catch { /* ignore */ }
  // Also try from the folder root
  return null
})

// ---- scanner ----

interface FNode { name: string; path: string; type: 'file' | 'directory'; children?: FNode[] }

const TEXT_EXTENSIONS = new Set([
  // Markdown & docs
  'md', 'markdown', 'txt', 'text', 'rst', 'adoc', 'org', 'tex',
  // Data & config
  'json', 'yaml', 'yml', 'toml', 'xml', 'csv', 'tsv', 'ini', 'cfg', 'conf', 'env', 'properties',
  // Logs
  'log',
  // Web
  'html', 'htm', 'css', 'scss', 'less', 'sass', 'vue', 'svelte',
  // JavaScript / TypeScript
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
  // Programming languages
  'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'swift', 'kt', 'scala',
  'lua', 'r', 'R', 'pl', 'pm', 'php',
  // Shell
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
  // Database
  'sql', 'graphql', 'proto',
  // Diff
  'diff', 'patch',
  // Other
  'dockerfile', 'makefile', 'cmake', 'gradle',
])

// Filenames (without extension) that should also be treated as text files
const TEXT_FILENAMES = new Set([
  'Makefile', 'Dockerfile', 'Vagrantfile', 'Gemfile', 'Rakefile',
  'Procfile', 'Brewfile', 'Podfile', 'Fastfile',
  '.gitignore', '.gitattributes', '.editorconfig', '.eslintrc', '.prettierrc',
  '.babelrc', '.npmrc', '.yarnrc', '.nvmrc', '.node-version',
  '.env', '.env.local', '.env.development', '.env.production', '.env.test',
])

function isTextFile(name: string): boolean {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  return TEXT_EXTENSIONS.has(ext) || TEXT_FILENAMES.has(name)
}

function scanDir(dir: string): FNode[] {
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) }
  catch { return [] } // 权限不足等错误，跳过该目录

  const out: FNode[] = []
  for (const f of entries) {
    if (f.name.startsWith('.') && !TEXT_FILENAMES.has(f.name)) continue
    const full = path.join(dir, f.name)
    if (f.isDirectory()) {
      out.push({ name: f.name, path: full, type: 'directory', children: scanDir(full) })
    } else if (isTextFile(f.name)) {
      out.push({ name: f.name, path: full, type: 'file' })
    }
  }
  out.sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1)
  return out
}
