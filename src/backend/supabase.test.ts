import { describe, expect, it } from 'vitest'
import { getOAuthRedirectUrl } from './supabase'

describe('OAuth redirect URL', () => {
  it('returns to the current local app origin', () => {
    expect(getOAuthRedirectUrl('http://localhost:5173')).toBe('http://localhost:5173/')
  })

  it('returns to the current deployed Vercel origin', () => {
    expect(getOAuthRedirectUrl('https://lagoon-example.vercel.app')).toBe('https://lagoon-example.vercel.app/')
  })

  it('uses the configured production site URL before the Vercel URL', () => {
    expect(getOAuthRedirectUrl('http://localhost:5173', 'https://lagoon-liart.vercel.app', 'other-preview.vercel.app'))
      .toBe('https://lagoon-liart.vercel.app/')
  })

  it('adds HTTPS to a configured Vercel hostname', () => {
    expect(getOAuthRedirectUrl('http://localhost:5173', undefined, 'lagoon-liart.vercel.app'))
      .toBe('https://lagoon-liart.vercel.app/')
  })
})
