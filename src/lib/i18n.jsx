import { useEffect, useState } from 'react'
import { EN, RU } from './i18n-ru'

// English is the source language: every UI string is written in English and t() looks
// up its Russian form when RU is selected, falling back to the English text, so a string
// that has no translation yet still reads correctly instead of disappearing.
//
// Values that are also data (status, category, priority names) stay English internally —
// filters compare against them — and are passed through t() only where they are shown.

const KEY = 'ui-lang'
let lang = 'en'
try { lang = localStorage.getItem(KEY) === 'ru' ? 'ru' : 'en' } catch { /* storage blocked */ }
document.documentElement.lang = lang

export const getLang = () => lang

export function setLang(next) {
  lang = next === 'ru' ? 'ru' : 'en'
  try { localStorage.setItem(KEY, lang) } catch { /* storage blocked */ }
  document.documentElement.lang = lang
  window.dispatchEvent(new Event('ui-lang-change'))
}

// t('Cable Schedule') · t('{n} cables', { n: 12 })
export function t(s, vars) {
  if (s == null) return s
  let out = (lang === 'ru' ? RU[s] : undefined) ?? EN[s] ?? s
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v))
  return out
}

// Locale for number/date formatting that matches the chosen language.
export const locale = () => (lang === 'ru' ? 'ru-RU' : 'en-GB')

export function useLang() {
  const [l, setL] = useState(lang)
  useEffect(() => {
    const h = () => setL(lang)
    window.addEventListener('ui-lang-change', h)
    return () => window.removeEventListener('ui-lang-change', h)
  }, [])
  return l
}

export function LangToggle({ className = '' }) {
  const l = useLang()
  return (
    <div className={`lang-toggle ${className}`} role="group" aria-label="Language">
      <button type="button" className={l === 'en' ? 'active' : ''} aria-pressed={l === 'en'} onClick={() => setLang('en')}>EN</button>
      <button type="button" className={l === 'ru' ? 'active' : ''} aria-pressed={l === 'ru'} onClick={() => setLang('ru')}>RU</button>
    </div>
  )
}
