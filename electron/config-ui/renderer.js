const input = document.getElementById('server-url-input')
const testBtn = document.getElementById('test-btn')
const saveBtn = document.getElementById('save-btn')
const status = document.getElementById('status')

function showStatus(ok, message) {
  status.className = ok ? 'ok' : 'err'
  status.textContent = message
}

window.acadexaDesktop.getConfig().then((config) => {
  if (config?.apiBaseUrl) {
    input.value = config.apiBaseUrl.replace(/\/api\/v1$/, '')
  }
})

testBtn.addEventListener('click', async () => {
  if (!input.value.trim()) {
    showStatus(false, 'Please enter a server address first.')
    return
  }
  testBtn.disabled = true
  testBtn.textContent = 'Testing...'
  const result = await window.acadexaDesktop.testConnection(input.value)
  showStatus(result.ok, result.message)
  testBtn.disabled = false
  testBtn.textContent = 'Test Connection'
})

saveBtn.addEventListener('click', async () => {
  if (!input.value.trim()) {
    showStatus(false, 'Please enter a server address first.')
    return
  }
  saveBtn.disabled = true
  saveBtn.textContent = 'Saving...'
  await window.acadexaDesktop.saveServerUrl(input.value)
  await window.acadexaDesktop.reconfigure()
})

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveBtn.click()
})
