import { useCallback, useEffect, useRef, useState } from 'react'

export type Load<T> =
  | { status: 'loading' }
  | { status: 'loaded'; data: T }
  | { status: 'failed'; error: Error }

type Settled<T> = Exclude<Load<T>, { status: 'loading' }>

/**
 * Runs `load` and reports where it stands.
 *
 * `load` has to keep its identity between renders (a module function, or a
 * `useCallback`), because a new function is a new thing to load. A result is
 * shown only for the function that produced it, so one story's records are
 * never shown under another story's address while the second one loads.
 */
export function useLoad<T>(load: () => Promise<T>): Load<T> {
  return useReloadableLoad(load)[0]
}

/**
 * `useLoad`, with a reload that runs `load` again and keeps showing the data
 * already loaded until the new data arrives. A screen that reloads after a
 * save does not drop back to loading, so what it holds on screen stays mounted.
 * The reload rejects when the load fails, and the earlier data stays.
 */
export function useReloadableLoad<T>(
  load: () => Promise<T>,
): [Load<T>, () => Promise<void>] {
  const [settled, setSettled] = useState<{
    load: () => Promise<T>
    result: Settled<T>
  } | null>(null)
  // Only the latest reload may replace the data, so two reloads that return
  // out of order cannot leave the older story on screen.
  const latestReload = useRef(0)

  useEffect(() => {
    let current = true
    load().then(
      (data) => {
        if (current) setSettled({ load, result: { status: 'loaded', data } })
      },
      (reason: unknown) => {
        const error = reason instanceof Error ? reason : new Error(String(reason))
        if (current) setSettled({ load, result: { status: 'failed', error } })
      },
    )
    return () => {
      current = false
    }
  }, [load])

  const reload = useCallback(async () => {
    const ticket = ++latestReload.current
    const data = await load()
    if (ticket === latestReload.current) setSettled({ load, result: { status: 'loaded', data } })
  }, [load])

  return [settled?.load === load ? settled.result : { status: 'loading' }, reload]
}
