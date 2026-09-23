import { describe, it, expect } from 'vitest'
import { normalizeError } from './client'

describe('normalizeError', () => {
  it('returns friendly message for 401 authentication error with backend message', () => {
    const error = {
      response: {
        status: 401,
        data: {
          error: {
            code: 'AUTHENTICATION_ERROR',
            message: 'Invalid email or password.',
          },
        },
      },
    }
    const result = normalizeError(error)
    expect(result.code).toBe('AUTHENTICATION_ERROR')
    expect(result.message).toBe('Incorrect email/username or password. Please check your credentials.')
    expect(result.status).toBe(401)
  })

  it('returns friendly message for 401 on login endpoint without response data', () => {
    const error = {
      config: { url: '/api/v1/auth/login' },
      response: {
        status: 401,
      },
    }
    const result = normalizeError(error)
    expect(result.code).toBe('AUTHENTICATION_ERROR')
    expect(result.message).toBe('Incorrect email/username or password. Please check your credentials.')
  })

  it('is idempotent: does NOT turn an already normalized error into a network error', () => {
    const error = {
      response: {
        status: 401,
        data: {
          error: {
            code: 'AUTHENTICATION_ERROR',
            message: 'Invalid email or password.',
          },
        },
      },
    }
    const firstPass = normalizeError(error)
    // Simulating second pass in catch block
    const secondPass = normalizeError(firstPass)
    expect(secondPass.code).toBe('AUTHENTICATION_ERROR')
    expect(secondPass.message).toBe('Incorrect email/username or password. Please check your credentials.')
    expect(secondPass.status).toBe(401)
  })

  it('formats HTTP 500 server error properly', () => {
    const error = {
      response: {
        status: 500,
        data: null,
      },
    }
    const result = normalizeError(error)
    expect(result.code).toBe('SERVER_ERROR')
    expect(result.message).toContain('Server error (500)')
    expect(result.status).toBe(500)
  })

  it('formats HTTP 503 service unavailable properly', () => {
    const error = {
      response: {
        status: 503,
        data: null,
      },
    }
    const result = normalizeError(error)
    expect(result.code).toBe('SERVER_ERROR')
    expect(result.message).toContain('Server error (503)')
  })

  it('identifies true Axios network errors when backend is offline', () => {
    const error = {
      isAxiosError: true,
      response: undefined,
      code: 'ERR_NETWORK',
      message: 'Network Error',
    }
    const result = normalizeError(error)
    expect(result.code).toBe('NETWORK_ERROR')
    expect(result.message).toContain('Unable to reach backend server')
  })

  it('identifies timeouts', () => {
    const error = {
      code: 'ECONNABORTED',
      message: 'timeout of 60000ms exceeded',
    }
    const result = normalizeError(error)
    expect(result.code).toBe('TIMEOUT')
    expect(result.message).toContain('Connection timed out')
  })
})
