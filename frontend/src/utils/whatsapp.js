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

/**
 * Opens WhatsApp Web or WhatsApp Desktop App with pre-filled message.
 * @param {string} phone
 * @param {string} text
 * @param {'web' | 'desktop' | 'universal'} target
 */
export function openWhatsApp(phone, text, target = 'web') {
  const urls = buildWhatsAppUrls(phone, text)
  let targetUrl = urls.webUrl
  if (target === 'desktop') {
    targetUrl = urls.appUrl
  } else if (target === 'universal') {
    targetUrl = urls.universalUrl
  }

  // Open in new tab/window or trigger desktop protocol
  window.open(targetUrl, '_blank', 'noopener,noreferrer')
  return urls
}
