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

  // Right-click context menu for copy/paste
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menuItems: Electron.MenuItemConstructorOptions[] = []

    if (params.selectionText) {
      menuItems.push({
        label: '复制',
        accelerator: 'CmdOrCtrl+C',
        role: 'copy',
      })
    }

    if (params.isEditable) {
      menuItems.push({
        label: '粘贴',
        accelerator: 'CmdOrCtrl+V',
        role: 'paste',
      })
      menuItems.push({
        label: '剪切',
        accelerator: 'CmdOrCtrl+X',
        role: 'cut',
      })
      menuItems.push({
        label: '全选',
        accelerator: 'CmdOrCtrl+A',
        role: 'selectAll',
      })
    } else if (params.selectionText) {
      menuItems.push({
        label: '全选',
        accelerator: 'CmdOrCtrl+A',
        role: 'selectAll',
      })
    }

    if (menuItems.length > 0) {
      Menu.buildFromTemplate(menuItems).popup({ window: mainWindow! })
    }
  })
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
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find...',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed())
            if (win && !win.webContents.isDestroyed()) {
              win.webContents.send('menu:find')
            }
          },
        },
      ],
    },
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
  // Strip anchor and query string, then URL-decode
  let cleanPath = relativePath.replace(/#[\w\-./]*$/, '').replace(/\?[\w=&]*$/, '')
  try { cleanPath = decodeURIComponent(cleanPath) } catch { /* ignore */ }
  if (!cleanPath) return null

  const dir = basePath.substring(0, basePath.lastIndexOf('/'))

  // For paths starting with '/', strip the leading '/' so we treat it as
  // relative to the workspace root (not filesystem root)
  const pathToResolve = cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath

  // Walk up from the file's directory, trying to resolve the path at each level
  let currentDir = dir
  for (let i = 0; i < 20; i++) {
    const resolved = path.resolve(currentDir, pathToResolve)

    // 1. Try exact match
    try {
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        return resolved
      }
    } catch { /* ignore */ }

    // 2. Try appending common extensions (for links without extension)
    const extensions = ['.md', '.markdown', '.txt', '.yaml', '.yml', '.json']
    for (const ext of extensions) {
      const withExt = resolved + ext
      try {
        if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
          return withExt
        }
      } catch { /* ignore */ }
    }

    // 3. Try treating as directory and look for README.md or index.md
    for (const indexFile of ['README.md', 'index.md', 'readme.md']) {
      const indexPath = path.join(resolved, indexFile)
      try {
        if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
          return indexPath
        }
      } catch { /* ignore */ }
    }

    // Walk up one level
    const parent = path.dirname(currentDir)
    if (parent === currentDir) break // reached filesystem root
    currentDir = parent
  }

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
