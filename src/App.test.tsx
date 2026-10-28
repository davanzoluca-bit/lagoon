import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'
import { demoWeatherSource, stations } from './domain/weather'
import { messages, t } from './i18n'

describe('weather source', () => {
  it('provides demo stations with a reading for each station', async () => {
    await expect(demoWeatherSource.getStations()).resolves.toEqual(stations)
    expect(stations.every(({ reading }) => Number.isFinite(reading.pressure) && Number.isFinite(reading.air))).toBe(true)
  })
})

describe('translations', () => {
  it('has matching keys and returns the selected language', () => {
    expect(Object.keys(messages.it).sort()).toEqual(Object.keys(messages.en).sort())
    expect(t('it', 'dashboard')).toBe('Dashboard')
    expect(t('en', 'dashboard')).toBe('Dashboard')
    expect(t('it', 'history')).toBe('Dati storici')
  })
})

describe('Lagoon app', () => {
  it('loads the dashboard and changes station, language and theme', async () => {
    render(<App />)
    expect((await screen.findAllByText('Punta della Salute')).length).toBeGreaterThan(0)
    expect(screen.getByText('18.4')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Seleziona stazione meteo'), { target: { value: 'burano' } })
    expect(screen.getByText('17.8')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'IT' }))
    expect(screen.getByRole('heading', { name: 'Good morning, Luca' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cambia tema' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('supports feed composition, messaging and profile events', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('navigation', { name: 'Navigazione principale' }).querySelectorAll('button')[1])
    fireEvent.change(screen.getByPlaceholderText('Cosa succede in laguna?'), { target: { value: 'Acqua calma oggi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pubblica' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Condivisione inviata alla moderazione')
    fireEvent.click(screen.getByRole('navigation', { name: 'Navigazione principale' }).querySelectorAll('button')[2])
    fireEvent.change(screen.getByPlaceholderText('Scrivi un messaggio…'), { target: { value: 'A domani!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Invia' }))
    expect(screen.getByText('A domani!')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('navigation', { name: 'Esplora' }).querySelectorAll('button')[2])
    fireEvent.click(screen.getAllByRole('button', { name: /Registra evento/ })[0])
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('+10 punti'))
    expect(screen.getByText('Pescata · oggi')).toBeInTheDocument()
  })

  it('filters history, shows an empty state and navigates to forecast', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('navigation', { name: 'Esplora' }).querySelectorAll('button')[0])
    expect(await screen.findByText('3', { selector: '.table-footer strong' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Anno'), { target: { value: '2025' } })
    expect(screen.getByText('Nessun dato disponibile')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('navigation', { name: 'Esplora' }).querySelectorAll('button')[1])
    expect(screen.getByRole('heading', { name: 'Previsioni' })).toBeInTheDocument()
  })

  it('covers dashboard shortcuts, notifications, settings and mobile navigation', async () => {
    render(<App />)
    await screen.findByText('18.4')
    fireEvent.change(screen.getByLabelText('Cerca'), { target: { value: 'Burano' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cambia tema' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cambia tema' }))
    fireEvent.change(screen.getByLabelText('Intervallo grafico'), { target: { value: '24 ore' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apri previsioni' }))
    expect(screen.getByRole('heading', { name: 'Previsioni' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '30 giorni' }))
    fireEvent.click(screen.getByRole('button', { name: '7 giorni' }))
    fireEvent.click(screen.getByRole('navigation', { name: 'Navigazione principale' }).querySelectorAll('button')[0])
    fireEvent.click(document.querySelector('.page-heading button')!)
    expect(screen.getByRole('heading', { name: 'Dati storici' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Impostazioni' }))
    expect(screen.getByRole('heading', { name: 'Il mio profilo' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Luca Marin/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Notifiche' }))
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apri menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi navigazione' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apri menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi menu' }))
    fireEvent.click(screen.getByRole('navigation', { name: 'Navigazione principale' }).querySelectorAll('button')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Vedi tutto' }))
    expect(screen.getByRole('heading', { name: 'Community' })).toBeInTheDocument()
  })
})
