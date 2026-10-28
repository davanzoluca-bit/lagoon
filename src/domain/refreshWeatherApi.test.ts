import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../../api/refresh-weather'

describe('Vercel live-weather API', () => {
  const env = (globalThis as typeof globalThis & { process: { env: Record<string, string | undefined> } }).process.env
  const oldEnv = {
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  }

  afterEach(() => {
    Object.assign(env, oldEnv)
    vi.unstubAllGlobals()
  })

  it('requires an authenticated POST before contacting external services', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = { statusCode: 200, body: null as unknown }
    const response = { status(code: number) { result.statusCode = code; return this }, json(body: unknown) { result.body = body } }

    await handler({ method: 'POST', headers: {} }, response)

    expect(result.statusCode).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('validates the session and upserts source readings idempotently', async () => {
    env.SUPABASE_URL = 'https://project.supabase.co'
    env.SUPABASE_PUBLISHABLE_KEY = 'publishable-test-key'
    env.SUPABASE_SERVICE_ROLE_KEY = 'service-test-key'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ ID_stazione: '1025', data: '2026-10-26 23:10:00', valore: '17.3 °C' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response('[]', { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const result = { statusCode: 200, body: null as unknown }
    const response = { status(code: number) { result.statusCode = code; return this }, json(body: unknown) { result.body = body } }

    await handler({ method: 'POST', headers: { authorization: 'Bearer signed-in-user-token' } }, response)

    expect(result.statusCode).toBe(200)
    expect(result.body).toEqual({ ok: true, received: 1, inserted: [] })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[2][0]).toContain('on_conflict=station_id,recorded_at')
    expect(fetchMock.mock.calls[2][1].headers.Prefer).toContain('resolution=ignore-duplicates')
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual([{
      station_id: '590ab8d1-c1f1-4e11-913d-a13fb45ef3d7', recorded_at: '2026-10-26 23:10:00', water_temp_c: 17.3, tide_level_m: null,
    }])
  })
})
