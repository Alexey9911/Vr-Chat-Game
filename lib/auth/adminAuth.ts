/**
 * Admin Authentication Utilities
 * Handles admin detection via URL params and password validation
 */

const ADMIN_PASSWORD = '991132'
const ADMIN_URL_PARAM = 'admin'
const ADMIN_URL_VALUE = 'admin'

/**
 * Check if the URL contains admin parameters
 */
export function checkAdminURL(): boolean {
  if (typeof window === 'undefined') return false
  
  const params = new URLSearchParams(window.location.search)
  return params.get(ADMIN_URL_PARAM) === ADMIN_URL_VALUE
}

/**
 * Validate admin password
 */
export function validateAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD
}

/**
 * Get admin profile configuration
 */
export function getAdminProfile(nickname: string) {
  return {
    name: `[ADMIN] ${nickname}`,
    color: '#ffffff',
    skinId: 'alon',  // Admin uses alon skin (default)
    isAdmin: true,
    colors: {
      primary: '#ff00ff',
      secondary: '#00ffff',
      accent: '#ffff00',
    },
  }
}

/**
 * Store admin status in sessionStorage
 */
export function setAdminStatus(isAdmin: boolean): void {
  if (typeof window === 'undefined') return
  
  if (isAdmin) {
    sessionStorage.setItem('isAdmin', 'true')
  } else {
    sessionStorage.removeItem('isAdmin')
  }
}

/**
 * Get admin status from sessionStorage
 */
export function getAdminStatus(): boolean {
  if (typeof window === 'undefined') return false
  
  return sessionStorage.getItem('isAdmin') === 'true'
}

/**
 * Clear admin status
 */
export function clearAdminStatus(): void {
  if (typeof window === 'undefined') return
  
  sessionStorage.removeItem('isAdmin')
}
