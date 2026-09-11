/**
 * Acadexa Desktop — Electron main process.
 *
 * This is a *thin client* shell: it does not run the FastAPI backend or
 * PostgreSQL locally. Instead, each academy computer running this .exe
 * connects over the internet to ONE central Acadexa backend server (the
 * FastAPI + PostgreSQL stack, deployed on a VPS/cloud host by the
 * academy's IT admin). This matches the requirement that attendance/marks
 * data is centralized and shared live across multiple computers.
 *
 * On first run (or whenever the admin chooses "Change Server URL..." from
 * the menu), a small configuration screen asks for the central server's
 * base URL (e.g. https://api.myacademy.com). That URL is persisted to
 * app.getPath('userData')/config.json and injected into the React app via
 * preload.js as window.__ACADEXA_API_BASE_URL__.
 */
const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')

function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

/** Normalizes a user-entered server URL into a full API base URL ending in /api/v1. */
function normalizeServerUrl(input) {
  let url = input.trim()
  if (!/^https?:\/\//i.test(url)) {
    url = 'http://' + url
  }
  url = url.replace(/\/+$/, '')
  if (!url.endsWith('/api/v1')) {
    url = url + '/api/v1'
  }
  return url
}

let mainWindow = null

function loadConfigScreen() {
  mainWindow.loadFile(path.join(__dirname, 'config-ui', 'index.html'))
}

function loadApp() {
  mainWindow.loadFile(path.join(__dirname, 'app-dist', 'index.html'))
}

function buildMenu() {
  const template = [
    {
      label: 'Acadexa',
      submenu: [
        {
          label: 'Change Server URL...',
          click: () => loadConfigScreen(),
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            const config = readConfig()
            if (config?.apiBaseUrl) loadApp()
            else loadConfigScreen()
          },
        },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Acadexa',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Acadexa',
              message: `Acadexa Desktop\nVersion ${app.getVersion()}`,
              detail:
                'Academy Attendance & Student Management System.\n' +
                'This desktop app connects to your academy\'s central Acadexa server.',
            })
          },
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    title: 'Acadexa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload needs fs/path access to read config.json
    },
  })

  // Open any target=_blank / window.open links (e.g. report downloads) in the OS browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const config = readConfig()
  if (config?.apiBaseUrl) {
    loadApp()
  } else {
    loadConfigScreen()
  }
}

// --- IPC handlers used by config-ui/renderer.js and preload.js ---

// Synchronous variant so preload.js can inject window.__ACADEXA_API_BASE_URL__
// before the renderer's own module scripts execute.
ipcMain.on('acadexa:get-config-sync', (event) => {
  event.returnValue = readConfig()
})

ipcMain.handle('acadexa:get-config', () => readConfig())

ipcMain.handle('acadexa:save-server-url', (_event, rawUrl) => {
  const apiBaseUrl = normalizeServerUrl(rawUrl)
  writeConfig({ apiBaseUrl, savedAt: new Date().toISOString() })
  return { apiBaseUrl }
})

ipcMain.handle('acadexa:test-connection', async (_event, rawUrl) => {
  const apiBaseUrl = normalizeServerUrl(rawUrl)
  try {
    const healthUrl = apiBaseUrl.replace(/\/api\/v1$/, '/health')
    const response = await fetch(healthUrl, { method: 'GET' })
    if (!response.ok) return { ok: false, message: `Server responded with HTTP ${response.status}` }
    const data = await response.json()
    return { ok: true, message: `Connected: ${data.app || 'Acadexa'} (${data.env || 'unknown'})` }
  } catch (err) {
    return { ok: false, message: `Could not reach server: ${err.message}` }
  }
})

ipcMain.handle('acadexa:load-app', () => {
  loadApp()
})

app.whenReady().then(() => {
  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
