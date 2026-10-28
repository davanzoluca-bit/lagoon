import type { FormEvent } from 'react'
import { Waves } from 'lucide-react'
import { Button } from './Button'
import { Field } from './Field'
import { t, type Language } from '../../i18n'
import './AuthScreen.css'

type AuthScreenProps = {
  mode: 'signin' | 'signup'
  setMode: (value: 'signin' | 'signup') => void
  email: string
  setEmail: (value: string) => void
  password: string
  setPassword: (value: string) => void
  name: string
  setName: (value: string) => void
  busy: boolean
  error: string
  lang: Language
  onOAuth: (provider: 'google' | 'custom:instagram') => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function AuthScreen({ mode, setMode, email, setEmail, password, setPassword, name, setName, busy, error, lang, onOAuth, onSubmit }: AuthScreenProps) {
  const tr = (key: Parameters<typeof t>[1]) => t(lang, key)
  return <main className="auth-screen"><section className="auth-layout">
    <aside className="auth-story">
      <div className="auth-story__top"><div className="brand"><div className="brand-mark"><Waves size={21} strokeWidth={2.4}/></div><span>lagoon<span className="brand-dot">.</span></span></div><span className="auth-kicker">{tr('authKicker')}</span></div>
      <div className="auth-story__copy"><span className="auth-overline"><i/> {tr('authOverline')}</span><h1>{tr('authStoryTitle').split(' ').slice(0, -2).join(' ')}<br/>{tr('authStoryTitle').split(' ').slice(-2).join(' ')}</h1><p>{tr('authStoryText')}</p><div className="auth-orbit" aria-hidden="true"><div className="auth-sun"/><div className="auth-horizon"/><div className="auth-wave auth-wave--one"/><div className="auth-wave auth-wave--two"/><div className="auth-coord">45°26' N&nbsp; · &nbsp;12°20' E</div><span className="auth-orbit__tag">{tr('area').toUpperCase()} <Waves size={13}/></span></div></div>
      <div className="auth-story__foot"><span>{tr('authMotto')}</span><span>{tr('authEst')}</span></div>
    </aside>
    <section className="auth-panel"><div className="auth-panel__inner">
      <span className="auth-mobile-brand"><Waves size={18}/> lagoon<span>.</span></span>
      <div className="auth-heading"><span className="auth-heading__eyebrow">{tr(mode === 'signin' ? 'authWelcomeEyebrow' : 'authSignupEyebrow')}</span><h2>{tr(mode === 'signin' ? 'authWelcome' : 'authJoin')}</h2><p>{tr(mode === 'signin' ? 'authSigninText' : 'authSignupText')}</p></div>
      <div className="auth-socials"><button className="auth-social auth-social--google" type="button" disabled={busy} onClick={() => onOAuth('google')}><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.23a4.47 4.47 0 0 1-1.94 2.94v2.42h3.14c1.84-1.7 2.92-4.21 2.92-7.19Z"/><path fill="#34A853" d="M12 21.75c2.63 0 4.83-.87 6.44-2.34l-3.14-2.42c-.87.58-1.99.92-3.3.92-2.54 0-4.69-1.72-5.46-4.04H3.3v2.5a9.72 9.72 0 0 0 8.7 5.38Z"/><path fill="#FBBC05" d="M6.54 13.87a5.84 5.84 0 0 1 0-3.74v-2.5H3.3a9.74 9.74 0 0 0 0 8.74l3.24-2.5Z"/><path fill="#EA4335" d="M12 6.1c1.43 0 2.72.49 3.73 1.47l2.8-2.8C16.82 3.17 14.63 2.25 12 2.25A9.72 9.72 0 0 0 3.3 7.63l3.24 2.5C7.31 7.81 9.46 6.1 12 6.1Z"/></svg>{tr('continueGoogle')}</button>
        <button className="auth-social auth-social--instagram" type="button" disabled={busy} onClick={() => onOAuth('custom:instagram')}><svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="ig-gradient" x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse"><stop stopColor="#FEDA75"/><stop offset=".42" stopColor="#D62976"/><stop offset="1" stopColor="#4F5BD5"/></linearGradient></defs><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="url(#ig-gradient)" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="url(#ig-gradient)" strokeWidth="2"/><circle cx="17.5" cy="6.8" r="1.1" fill="#D62976"/></svg>{tr('continueInstagram')} <small>{tr('businessCreator')}</small></button></div>
      <div className="auth-divider"><span>{tr('orEmail')}</span></div>
      <form className="auth-form" onSubmit={onSubmit}>
        {mode === 'signup' && <Field label={tr('yourName')}><input className="ds-field__control" autoComplete="name" placeholder={tr('namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} required/></Field>}
        <Field label={tr('email')}><input className="ds-field__control" type="email" autoComplete="email" placeholder={tr('emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} required/></Field>
        <Field label={tr('password')}><input className="ds-field__control" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder={tr('passwordPlaceholder')} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}/></Field>
        {error && <p className="backend-error" role="alert">{error}</p>}
        <Button type="submit" variant="primary" disabled={busy}>{busy ? tr('pleaseWait') : mode === 'signin' ? tr('signInEmail') : tr('createAccount')}</Button>
      </form>
      <p className="auth-legal">{tr('authLegal')}</p>
      <div className="auth-mode-switch">{tr(mode === 'signin' ? 'newToLagoon' : 'alreadyAccount')} <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>{tr(mode === 'signin' ? 'createAccount' : 'signInEmail')}</button></div>
      <div className="auth-provider-note">{tr('instagramHint')}</div>
    </div></section>
  </section></main>
}
