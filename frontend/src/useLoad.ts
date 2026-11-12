import { useEffect, useState } from 'react'

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
  const [settled, setSettled] = useState<{
    load: () => Promise<T>
    result: Settled<T>
  } | null>(null)

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

  return settled?.load === load ? settled.result : { status: 'loading' }
}
