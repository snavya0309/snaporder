import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'snaporder.calorieTracker.v1'

export function useCalorieTracker() {
  const [state, setState] = useState(readTracker)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const total = useMemo(
    () => state.entries.reduce((sum, entry) => sum + (entry.calories || 0), 0),
    [state.entries]
  )

  const itemCount = useMemo(
    () => state.entries.reduce((sum, entry) => sum + (entry.quantity || 1), 0),
    [state.entries]
  )

  const macros = useMemo(
    () => state.entries.reduce((sum, entry) => {
      if (!entry.macros) return sum
      return {
        carbs: sum.carbs + (entry.macros.carbs || 0),
        protein: sum.protein + (entry.macros.protein || 0),
        fat: sum.fat + (entry.macros.fat || 0)
      }
    }, { carbs: 0, protein: 0, fat: 0 }),
    [state.entries]
  )

  const addEntry = useCallback(entry => {
    setState(current => {
      const day = localDayKey()
      const base = current.day === day ? current : { day, entries: [] }
      return {
        day,
        entries: [
          {
            id: createId(),
            orderedAt: new Date().toISOString(),
            ...entry
          },
          ...base.entries
        ].slice(0, 24)
      }
    })
  }, [])

  const clearToday = useCallback(() => {
    setState({ day: localDayKey(), entries: [] })
  }, [])

  return {
    day: state.day,
    entries: state.entries,
    total,
    itemCount,
    macros,
    addEntry,
    clearToday
  }
}

function readTracker() {
  const empty = { day: localDayKey(), entries: [] }
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (!stored || stored.day !== empty.day || !Array.isArray(stored.entries)) return empty
    return stored
  } catch {
    return empty
  }
}

function localDayKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `entry-${Date.now()}-${Math.floor(Math.random() * 10000)}`
}
