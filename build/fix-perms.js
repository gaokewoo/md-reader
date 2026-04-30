const fs = require('fs')
const path = require('path')

// Fix spawn-helper execute permission in packaged app
// electron-builder strips execute permission, but node-pty needs it
function fixPermissions(appPath) {
  const unpackedDir = path.join(
    appPath,
    'Contents',
    'Resources',
    'app.asar.unpacked',
    'node_modules',
    'node-pty'
  )

  function fix(dir) {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        fix(fullPath)
      } else if (entry.name === 'spawn-helper') {
        try {
          fs.chmodSync(fullPath, 0o755)
          console.log('[fix-perms] Fixed:', fullPath)
        } catch (e) {
          console.warn('[fix-perms] Failed:', fullPath, e.message)
        }
      }
    }
  }

  fix(unpackedDir)
}

const releaseDir = path.join(__dirname, '..', 'release')

// Fix for mac-arm64
const armApp = path.join(releaseDir, 'mac-arm64', 'MD Reader.app')
if (fs.existsSync(armApp)) fixPermissions(armApp)

// Fix for mac (x64)
const x64App = path.join(releaseDir, 'mac', 'MD Reader.app')
if (fs.existsSync(x64App)) fixPermissions(x64App)

console.log('[fix-perms] Done')
