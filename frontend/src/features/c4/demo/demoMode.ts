// Demonstration mode shows made-up data so screens can be looked at before
// their backend exists. It is for the Vite development server only.

export const DEMO_BANNER_TEXT = 'Demonstration data — not from the backend'

interface DemoEnvironment {
  DEV?: boolean
  VITE_C4_DEMO_DATA?: string
}

/**
 * True only when BOTH hold: the app is running in the Vite development
 * server, and VITE_C4_DEMO_DATA is exactly "true". A production build is never
 * in demonstration mode, whatever the variable says, and nothing ever switches
 * to demonstration data because a request failed.
 */
export function isDemoMode(env: DemoEnvironment = import.meta.env): boolean {
  return env.DEV === true && env.VITE_C4_DEMO_DATA === 'true'
}
