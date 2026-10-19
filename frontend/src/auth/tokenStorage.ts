// The only module that touches browser storage for authentication.
//
// sessionStorage is a prototype trade-off: the token survives a reload but is
// dropped when the tab closes. It is still readable by any script on the page,
// so an XSS bug would expose it. Nothing else (passwords, secrets) is stored.

const TOKEN_KEY = 'research-pms.accessToken'

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}
