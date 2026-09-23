/**
 * Preload script — runs in an isolated world before the renderer's own
 * scripts execute, so window.__ACADEXA_API_BASE_URL__ is guaranteed to be
 * set before src/api/client.js (bundled into app-dist) reads it.
 */
const { contextBridge, ipcRenderer } = require('electron')

// Synchronous IPC round-trip to main.js so the config is available
// BEFORE any of the page's own module scripts execute (module scripts run
// before DOMContentLoaded, so an async invoke() would be too late).
let cachedConfig = null
try {
  cachedConfig = ipcRenderer.sendSync('acadexa:get-config-sync')
} catch {
  cachedConfig = null
}

if (cachedConfig?.apiBaseUrl) {
  contextBridge.exposeInMainWorld('__ACADEXA_API_BASE_URL__', cachedConfig.apiBaseUrl)
}

contextBridge.exposeInMainWorld('acadexaDesktop', {
  isElectron: true,
  getConfig: () => ipcRenderer.invoke('acadexa:get-config'),
  saveServerUrl: (url) => ipcRenderer.invoke('acadexa:save-server-url', url),
  testConnection: (url) => ipcRenderer.invoke('acadexa:test-connection', url),
  reconfigure: () => ipcRenderer.invoke('acadexa:load-app'),
  openExternal: (url) => ipcRenderer.invoke('acadexa:open-external', url),
})
