// Shared password policy: >=8 chars, upper, lower, number, special character.
export const passwordChecks = (pw = '') => ({
  'At least 8 characters': pw.length >= 8,
  'One uppercase letter':  /[A-Z]/.test(pw),
  'One lowercase letter':  /[a-z]/.test(pw),
  'One number':            /\d/.test(pw),
  'One special character': /[^A-Za-z0-9]/.test(pw),
})

export const isPasswordValid = (pw) => Object.values(passwordChecks(pw)).every(Boolean)

export default function PasswordChecklist({ password }) {
  if (!password) return null
  const checks = passwordChecks(password)
  return (
    <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
      {Object.entries(checks).map(([label, ok]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.72rem', color: ok ? '#1DB954' : 'var(--text-faint, #8a8a9a)', transition: 'color 0.15s' }}>
          <span style={{ fontSize: '0.72rem', width: 12, display: 'inline-block' }}>{ok ? '✓' : '○'}</span>
          {label}
        </div>
      ))}
    </div>
  )
}
