/**
 * WhatsApp utilities for phone formatting and link generation.
 */

export function cleanPhoneNumber(raw, defaultCountryCode = '92') {
  if (!raw) return ''
  let digits = String(raw).replace(/\D/g, '')

  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  } else if (digits.startsWith('0') && digits.length >= 10) {
    digits = defaultCountryCode + digits.slice(1)
  } else if (digits.length === 10 && !digits.startsWith(defaultCountryCode)) {
    digits = defaultCountryCode + digits
  }
  return digits
}

export function buildWhatsAppUrls(phone, text, defaultCountryCode = '92') {
  const cleanPhone = cleanPhoneNumber(phone, defaultCountryCode)
  const encodedText = encodeURIComponent(text || '')

  return {
    cleanPhone,
    webUrl: `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`,
    appUrl: `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`,
    universalUrl: `https://wa.me/${cleanPhone}?text=${encodedText}`,
    apiUrl: `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`,
  }
}

export function getStoredWhatsAppTarget() {
  try {
    return localStorage.getItem('acadexa_whatsapp_target') || 'desktop'
  } catch {
    return 'desktop'
  }
}

export function setStoredWhatsAppTarget(target) {
  try {
    if (target) localStorage.setItem('acadexa_whatsapp_target', target)
  } catch {
    // ignore in environments without localStorage
  }
}

/**
 * Opens WhatsApp Desktop App, WhatsApp Web, or wa.me Direct with pre-filled message.
 * Defaults to 'desktop' (WhatsApp Desktop App) to open directly in the desktop application.
 * @param {string} phone
 * @param {string} text
 * @param {'web' | 'desktop' | 'universal'} [target]
 */
export function openWhatsApp(phone, text, target) {
  const effectiveTarget = target || getStoredWhatsAppTarget()
  const urls = buildWhatsAppUrls(phone, text)
  let targetUrl = urls.appUrl
  if (effectiveTarget === 'web') {
    targetUrl = urls.webUrl
  } else if (effectiveTarget === 'universal') {
    targetUrl = urls.universalUrl
  }

  // 1. If running inside Electron desktop shell, invoke openExternal via IPC
  if (typeof window !== 'undefined' && window.acadexaDesktop?.openExternal) {
    try {
      window.acadexaDesktop.openExternal(targetUrl)
      return urls
    } catch (e) {
      console.warn('acadexaDesktop.openExternal failed:', e)
    }
  }

  // 2. If browser environment with custom URI protocol (whatsapp://)
  if (typeof window !== 'undefined' && targetUrl.startsWith('whatsapp://')) {
    try {
      const a = document.createElement('a')
      a.href = targetUrl
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        try {
          if (a.parentNode) a.parentNode.removeChild(a)
        } catch {
          // ignore
        }
      }, 1000)
      return urls
    } catch {
      window.location.href = targetUrl
      return urls
    }
  }

  // 3. Fallback for web links (web.whatsapp.com / wa.me)
  if (typeof window !== 'undefined') {
    window.open(targetUrl, '_blank', 'noopener,noreferrer')
  }
  return urls
}

