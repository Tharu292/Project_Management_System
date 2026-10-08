import { createContext, useContext } from 'react'
import { useOutletContext } from 'react-router'
import type { MyGroup } from '../api/types'

export type MyGroupsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; groups: MyGroup[] }

export interface MyGroupsValue {
  state: MyGroupsState
  /** Asks the backend again after a failure. */
  retry: () => void
}

export const MyGroupsContext = createContext<MyGroupsValue | null>(null)

export function useMyGroups(): MyGroupsValue {
  const value = useContext(MyGroupsContext)
  if (value === null) {
    throw new Error('useMyGroups must be used inside <MyGroupsProvider>.')
  }
  return value
}

/** The group a page inside GroupLayout belongs to. GroupLayout has already checked that it is one of the user's. */
export function useCurrentGroup(): MyGroup {
  return useOutletContext<MyGroup>()
}
