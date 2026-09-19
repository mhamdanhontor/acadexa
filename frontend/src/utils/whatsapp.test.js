import { describe, it, expect } from 'vitest'
import { cleanPhoneNumber, buildWhatsAppUrls } from './whatsapp'

describe('WhatsApp utilities', () => {
  it('cleans standard local numbers starting with 0', () => {
    expect(cleanPhoneNumber('03221742520')).toBe('923221742520')
    expect(cleanPhoneNumber('0300-1234567')).toBe('923001234567')
    expect(cleanPhoneNumber('0322 1742520')).toBe('923221742520')
  })

  it('cleans international numbers with + or 00', () => {
    expect(cleanPhoneNumber('+923221742520')).toBe('923221742520')
    expect(cleanPhoneNumber('00923221742520')).toBe('923221742520')
    expect(cleanPhoneNumber('+1 (555) 123-4567', '1')).toBe('15551234567')
  })

  it('builds proper WhatsApp URLs with urlencoded message', () => {
    const urls = buildWhatsAppUrls('+923221742520', 'Dear Parent, Hamdan was ABSENT on 2026-09-12.')
    expect(urls.cleanPhone).toBe('923221742520')
    expect(urls.webUrl).toContain('https://web.whatsapp.com/send?phone=923221742520&text=')
    expect(urls.webUrl).toContain('Dear%20Parent%2C%20Hamdan%20was%20ABSENT')
    expect(urls.appUrl).toContain('whatsapp://send?phone=923221742520&text=')
    expect(urls.universalUrl).toContain('https://wa.me/923221742520?text=')
  })
})
