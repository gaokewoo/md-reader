const fs = require('fs')
const path = require('path')

// Fix spawn-helper execute permission after packaging
// electron-builder strips execute permission from all files in asar.unpacked,
// but node-pty's spawn-helper MUST be executable for posix_spawnp to work

module.exports = async function(context) {
  // context.packager.appInfo.productFilename gives the app name
  const appName = context.packager.appInfo.productFilename
  const appOutDir = context.appOutDir
  const platform = context.electronPlatformName

  if (platform !== 'darwin') return

  const appPath = path.join(appOutDir, `${appName}.app`)
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
          console.log('[afterPack] Fixed spawn-helper permissions:', fullPath)
        } catch (e) {
          console.warn('[afterPack] Failed to fix permissions:', fullPath, e.message)
        }
      }
    }
  }

  fix(unpackedDir)
}
