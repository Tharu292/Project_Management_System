import { useCallback, useState } from 'react'
import { setUserEnabled } from '../../api/adminApi'
import type { AdminUser } from '../../auth/types'
import { secondaryButtonClass } from '../../components/AppShell'
import ConfirmDialog from '../../components/ConfirmDialog'
import { errorMessage } from './useAdminUsers'
import { fullName } from './userDisplay'

interface UserStatusActionProps {
  user: AdminUser
  /** Called with the account as the backend returned it after the change. */
  onChanged: (updated: AdminUser) => void
}

/**
 * The enable/disable control for one account, with a confirmation step.
 * Administrator accounts get no control: the backend refuses to change them.
 */
export default function UserStatusAction({ user, onChanged }: UserStatusActionProps) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cancel = useCallback(() => {
    setConfirming(false)
    setError(null)
  }, [])

  if (user.systemRole === 'ADMIN') {
    return <span className="text-xs text-slate-500">Administrator accounts cannot be disabled here</span>
  }

  const name = fullName(user)
  const disabling = user.enabled

  async function confirm() {
    if (busy) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const updated = await setUserEnabled(user.id, !user.enabled)
      setConfirming(false)
      onChanged(updated)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`${disabling ? 'Disable' : 'Enable'} ${name}`}
        className={secondaryButtonClass}
      >
        {disabling ? 'Disable' : 'Enable'}
      </button>
      {confirming && (
        <ConfirmDialog
          title={disabling ? `Disable ${name}?` : `Enable ${name}?`}
          confirmLabel={disabling ? 'Disable account' : 'Enable account'}
          busyLabel={disabling ? 'Disabling…' : 'Enabling…'}
          busy={busy}
          error={error}
          onConfirm={confirm}
          onCancel={cancel}
        >
          {disabling ? (
            <p>
              {user.email} will be signed out immediately and will not be able to sign in until the account is enabled
              again.
            </p>
          ) : (
            <p>{user.email} will be able to sign in again. They will need to sign in afresh.</p>
          )}
        </ConfirmDialog>
      )}
    </>
  )
}
