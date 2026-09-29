import { useCallback, useEffect, useRef, useState } from 'react'
import AddressMap from './AddressMap.jsx'
import './App.css'
import './profile.css'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function mapNominatimResult(result) {
  const parts = result.address || {}
  return {
    place_id: String(result.place_id),
    description: result.display_name,
    formatted: result.display_name,
    line1: `${parts.house_number || ''} ${parts.road || parts.neighbourhood || ''}`.trim(),
    city: parts.city || parts.town || parts.village || parts.suburb || '',
    state: parts.state || '',
    postalCode: parts.postcode || '',
    country: parts.country || '',
    latitude: Number(result.lat),
    longitude: Number(result.lon)
  }
}
const categories = [
  { icon: '⌂', title: 'Cleaning', detail: 'Home refresh', color: 'sage', image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80' },
  { icon: '⌁', title: 'Plumbing', detail: 'Fix a leak', color: 'blue', image: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=600&q=80' },
  { icon: '✦', title: 'Electrical', detail: 'Power & lights', color: 'gold', image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=600&q=80' },
  { icon: '◒', title: 'Appliances', detail: 'Keep it running', color: 'rose', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80' },
  { icon: '⌘', title: 'Carpentry', detail: 'Build & repair', color: 'wood', image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80' },
  { icon: '◈', title: 'Painting', detail: 'Refresh a room', color: 'gold', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&q=80' },
  { icon: '◎', title: 'Pest control', detail: 'Protect your home', color: 'rose', image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80' },
  { icon: '▣', title: 'Moving', detail: 'Make a move easier', color: 'blue', image: 'https://images.unsplash.com/photo-1600518464441-9154a4dea21b?auto=format&fit=crop&w=600&q=80' }
]

function App() {
  const queryToken = new URLSearchParams(window.location.search).get('token')
  const [token, setToken] = useState(() => queryToken || localStorage.getItem('fixmate_token'))
  const [user, setUser] = useState(null)
  const [mode, setMode] = useState(() => new URLSearchParams(window.location.search).get('reset_token') ? 'reset' : 'signup')
  const [showPassword, setShowPassword] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get('reset_token') || '')
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('fixmate_theme') === 'dark')

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    localStorage.setItem('fixmate_theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const socialError = params.get('socialError')
    const verification = params.get('verification')
    if (verification) {
      setMessage(verification === 'success' ? 'Email verified successfully. You can now log in.' : 'This verification link is invalid or expired.')
      setSubmitted(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (socialError) {
      const map = {
        google_not_configured: 'Google sign-in is not configured on this server yet.',
        facebook_not_configured: 'Facebook sign-in is not configured on this server yet.',
        google: 'Google sign-in failed. Please try again.',
        facebook: 'Facebook sign-in failed. Please try again.',
        google_missing_email: 'Google account has no email address available.',
        facebook_missing_email: 'Facebook account has no email address available.'
      }
      setMessage(map[socialError] || 'Social sign-in failed.')
      setSubmitted(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (queryToken) {
      localStorage.setItem('fixmate_token', queryToken)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [queryToken])

  useEffect(() => {
    if (!token) return
    fetch(`${apiUrl}/api/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() })
      .then((data) => setUser(data.user))
      .catch(() => { localStorage.removeItem('fixmate_token'); setToken(null) })
  }, [token])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    if (params.get('payment') !== 'success' || !sessionId || !token) return
    fetch(`${apiUrl}/api/payments/session-status?session_id=${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json()).then((data) => { if (data.user) { setUser(data.user); setMessage(`${data.user.planName} is now active on your account.`) } })
    window.history.replaceState({}, '', window.location.pathname)
  }, [token])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = formData.get('email')
    const payload = mode === 'forgot' ? { email } : mode === 'reset' ? { token: resetToken, password: formData.get('password') } : { name: formData.get('name'), email, password: formData.get('password'), rememberMe }
    try {
      const authEndpoint = mode === 'forgot' ? 'forgot-password' : mode === 'reset' ? 'reset-password' : mode
      const response = await fetch(`${apiUrl}/api/auth/${authEndpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setMessage(data.message)
      if (mode === 'reset') setMode('login')
      if (data.token) { localStorage.setItem('fixmate_token', data.token); setToken(data.token) }
    } catch (error) { setMessage(error.message || 'API is offline. Start the server to submit this form.') }
    setSubmitted(true)
  }

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    const body = new FormData(); body.append('avatar', file)
    try {
      const response = await fetch(`${apiUrl}/api/profile/avatar`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setUser((current) => ({ ...current, avatar: data.avatar }))
    } catch (error) { setMessage(error.message || 'Could not upload your photo.') }
    setUploading(false)
  }

  if (token && user) return <Dashboard user={user} message={message} setMessage={setMessage} darkMode={darkMode} setDarkMode={setDarkMode} uploadAvatar={uploadAvatar} uploading={uploading} onLogout={() => { localStorage.removeItem('fixmate_token'); setToken(null); setUser(null) }} />

  return <main className="auth-shell">
    <section className="brand-panel"><div className="brand-mark"><span>+</span> fixmate</div><div className="brand-copy"><p className="eyebrow">HOME CARE, MADE SIMPLE</p><h1>Good help is<br /><em>closer</em> than you think.</h1><p className="intro">From a dripping tap to a deep clean, find trusted professionals who treat your home like their own.</p></div><div className="service-note"><span className="spark">✦</span><span><strong>Trusted by 12,000+ homes</strong><br />across your neighborhood</span></div><div className="curve curve-one" /><div className="curve curve-two" /></section>
    <section className="form-panel"><button className="theme-toggle auth-theme-toggle" onClick={() => setDarkMode(!darkMode)}>{darkMode ? '☼ Light mode' : '◐ Dark mode'}</button><div className="form-inner"><div className="mobile-brand brand-mark"><span>+</span> fixmate</div><div className="topline"><span>{mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Recover your account' : mode === 'reset' ? 'Set a new password' : 'Welcome back'}</span><span className="step">01 <i /> 02</span></div><h2>{mode === 'signup' ? <>Let’s get you <em>home.</em></> : mode === 'forgot' ? <>Find your way <em>back.</em></> : mode === 'reset' ? <>Make it <em>secure.</em></> : <>Welcome <em>home.</em></>}</h2><p className="form-subtitle">{mode === 'signup' ? 'Join FixMate and make your home feel effortless.' : mode === 'forgot' ? 'We will send a secure reset link to your email.' : mode === 'reset' ? 'Choose a new password for your FixMate account.' : 'Sign in to manage your home services.'}</p>{mode !== 'forgot' && mode !== 'reset' && <div className="mode-switch" role="tablist"><button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setSubmitted(false) }}>Sign up</button><button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setSubmitted(false) }}>Log in</button></div>}
      <form onSubmit={handleSubmit}>{mode === 'signup' && <label>Full name<input name="name" type="text" placeholder="e.g. Maya Patel" required /></label>}{mode !== 'reset' && <label>Email address<input name="email" type="email" placeholder="you@example.com" required /></label>}{(mode === 'signup' || mode === 'login' || mode === 'reset') && <label>Password<div className="password-input"><input name="password" type={showPassword ? 'text' : 'password'} placeholder="At least 8 characters" minLength="8" required /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></div></label>}{mode === 'signup' && <label className="check-row"><input type="checkbox" required /><span>I agree to the <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a></span></label>}{mode === 'login' && <label className="check-row"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span>Remember me</span></label>}{submitted && <p className="success-message">{message}</p>}<button className="primary-button" type="submit">{mode === 'signup' ? 'Create my account' : mode === 'forgot' ? 'Send reset link' : mode === 'reset' ? 'Reset password' : 'Log in to FixMate'} <span>→</span></button></form>
      {mode === 'login' && <button className="forgot-link" onClick={() => { setMode('forgot'); setSubmitted(false) }}>Forgot your password?</button>}{mode !== 'forgot' && mode !== 'reset' && <><div className="divider"><span>or continue with</span></div><div className="social-row"><a href={`${apiUrl}/api/auth/google`}><b className="google">G</b> Google</a><a href={`${apiUrl}/api/auth/facebook`}><b className="facebook">f</b> Facebook</a></div><p className="fine-print">{mode === 'signup' ? 'Already have an account?' : 'New to FixMate?'} <button onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}>{mode === 'signup' ? 'Log in' : 'Create an account'}</button></p></>}
    </div></section>
  </main>
}

function Dashboard({ user, message, setMessage, darkMode, setDarkMode, uploadAvatar, uploading, onLogout }) {
  const firstName = user.name.split(' ')[0]
  const [view, setView] = useState(user.role === 'admin' ? 'admin' : 'home')
  const [address, setAddress] = useState(user.address || {})
  const [addressInput, setAddressInput] = useState(user.address?.formatted || '')
  const [suggestions, setSuggestions] = useState([])
  const searchTimeoutRef = useRef()
  const searchAbortRef = useRef()
  const [savingAddress, setSavingAddress] = useState(false)
  const [addressSaved, setAddressSaved] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState('')
  const [bookings, setBookings] = useState([])
  const [bookingService, setBookingService] = useState(null)

  useEffect(() => {
    if (!message) return undefined
    const timeout = window.setTimeout(() => setMessage(''), 4500)
    return () => window.clearTimeout(timeout)
  }, [message, setMessage])

  useEffect(() => {
    fetch(`${apiUrl}/api/bookings`, { headers: { Authorization: `Bearer ${localStorage.getItem('fixmate_token')}` } })
      .then((response) => response.json()).then((data) => setBookings(data.bookings || []))
  }, [])

  const searchAddress = (value) => {
    setAddressInput(value)
    window.clearTimeout(searchTimeoutRef.current)
    if (!value.trim()) {
      searchAbortRef.current?.abort()
      return setSuggestions([])
    }
    searchTimeoutRef.current = window.setTimeout(async () => {
      searchAbortRef.current?.abort()
      const controller = new AbortController()
      searchAbortRef.current = controller
      try {
        const response = await fetch(`${apiUrl}/api/profile/geocode/search?q=${encodeURIComponent(value.trim())}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('fixmate_token')}` },
          signal: controller.signal
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message)
        setSuggestions((data.results || []).map(mapNominatimResult))
      } catch (error) {
        if (error.name !== 'AbortError') setSuggestions([])
      }
    }, 400)
  }

  const chooseAddress = (suggestion) => {
    setAddressInput(suggestion.description)
    setSuggestions([])
    setAddress({ ...address, ...suggestion })
  }

  const saveAddress = async (event, nextAddress = address) => {
    event.preventDefault(); setSavingAddress(true); setAddressSaved(false)
    const response = await fetch(`${apiUrl}/api/profile/me`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('fixmate_token')}` }, body: JSON.stringify({ address: { ...nextAddress, formatted: nextAddress.formatted || addressInput } }) })
    const data = await response.json(); setSavingAddress(false)
    if (response.ok) { setAddress(data.user.address); setAddressInput(data.user.address.formatted || addressInput); setAddressSaved(true); setTimeout(() => setAddressSaved(false), 3000) }
  }

  const downloadProfile = async () => {
    const response = await fetch(`${apiUrl}/api/profile/me/export.pdf`, { headers: { Authorization: `Bearer ${localStorage.getItem('fixmate_token')}` } })
    if (!response.ok) return
    const blob = await response.blob()
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `fixmate-profile-${user._id}.pdf`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const startCheckout = async (plan) => {
    setCheckoutLoading(plan); setMessage(`Opening ${plan === 'plus' ? 'Plus' : 'Pro'} checkout...`)
    try {
      const response = await fetch(`${apiUrl}/api/payments/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('fixmate_token')}` }, body: JSON.stringify({ plan }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to start checkout.')
      if (data.user) { setUser(data.user); setMessage(`${data.user.planName} is active until ${new Date(data.user.planExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`); setCheckoutLoading(''); return }
      if (!data.url) throw new Error('Stripe did not return a checkout URL.')
      window.location.href = data.url
    } catch (error) { setCheckoutLoading(''); setMessage(error.message || 'Stripe is unavailable. Check that the API is running.') }
  }

  const createBooking = async (payload) => {
    const response = await fetch(`${apiUrl}/api/bookings`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('fixmate_token')}` }, body: JSON.stringify(payload) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Could not create booking.')
    setBookings((current) => [data.booking, ...current]); setBookingService(null); setMessage(data.message)
  }

  const cancelBooking = async (id) => {
    const response = await fetch(`${apiUrl}/api/bookings/${id}/cancel`, { method: 'PATCH', headers: { Authorization: `Bearer ${localStorage.getItem('fixmate_token')}` } })
    const data = await response.json()
    if (response.ok) setBookings((current) => current.map((booking) => booking._id === id ? data.booking : booking))
  }

  const homeExtras = <section className="home-content-extended"><div className="steps-heading"><p className="eyebrow">WHY FIXMATE</p><h2>Home care that feels effortless.</h2></div><div className="spotlight-strip">{categories.slice(0, 3).map((category) => <article className="spotlight-card" key={category.title}><img src={category.image} alt="" /><div className="spotlight-copy"><small>Popular this week</small><strong>{category.title} made simple</strong></div></article>)}</div><div className="metrics-strip"><div className="metric-item"><span>✦</span><div><strong>12k+</strong><small>happy homes served</small></div></div><div className="metric-item"><span>◷</span><div><strong>45 min</strong><small>average arrival time</small></div></div><div className="metric-item"><span>★</span><div><strong>4.9/5</strong><small>trusted service rating</small></div></div></div><div className="steps-section"><div className="steps-heading"><p className="eyebrow">HOW IT WORKS</p><h2>From request to done.</h2></div><div className="steps-grid"><article className="step-card"><span className="step-number">01</span><strong>Choose a service</strong><p>Tell us what your home needs and pick a time that works for you.</p></article><article className="step-card"><span className="step-number">02</span><strong>Meet a trusted pro</strong><p>We match your request with a verified professional nearby.</p></article><article className="step-card"><span className="step-number">03</span><strong>Enjoy your space</strong><p>Track the booking, get clear updates, and settle in comfortably.</p></article></div></div></section>

  const homeContent = <><section className="welcome-row"><div><p className="eyebrow">YOUR HOME, YOUR WAY</p><h1>Good morning, {firstName}<span>.</span></h1><p>What can we help you take care of today?</p></div><div className="profile-upload"><Avatar user={user} large /><label className="upload-button">{uploading ? 'Uploading...' : '+ Add photo'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} disabled={uploading} /></label></div></section>{message && <p className="dashboard-message">{message}</p>}<section className="dashboard-content"><div className="main-column"><div className="section-heading"><div><p className="eyebrow">EXPLORE SERVICES</p><h2>Make home feel easy.</h2></div><button className="text-button" onClick={() => setBookingService('choose')}>Explore all services <span>→</span></button></div><div className="category-grid">{categories.map((category) => <button className="category-card" key={category.title} onClick={() => setBookingService(category.title)}><img src={category.image} alt="" /><span className={`category-icon ${category.color}`}>{category.icon}</span><strong>{category.title}</strong><small>{category.detail}</small><span className="card-arrow">↗</span></button>)}</div><div className="booking-banner"><div><p className="eyebrow">NEED A HAND?</p><h3>Book your next service<br />in a few simple steps.</h3><button className="dark-button" onClick={() => setBookingService('choose')}>Browse all services <span>→</span></button></div><div className="banner-mark">⌂</div></div></div><aside className="side-column"><div className="side-heading"><h3>Your activity</h3><button className="text-button" onClick={() => setView('bookings')}>See all</button></div>{bookings.length ? <div className="activity-list">{bookings.slice(0, 3).map((booking) => <div className="activity-item" key={booking._id}><span>{booking.serviceIcon}</span><div><strong>{booking.service}</strong><small>{new Date(booking.scheduledDate).toLocaleDateString()}</small></div><b>{booking.status}</b></div>)}</div> : <div className="empty-activity"><span>✦</span><strong>No bookings yet</strong><p>Your next home improvement<br />story starts here.</p><button className="outline-button" onClick={() => setBookingService('choose')}>Find a service</button></div>}<div className="trust-card"><span>✦</span><div><strong>FixMate promise</strong><p>Trusted pros, clear pricing,<br />peace of mind.</p></div></div></aside></section>{homeExtras}</>
  return <main className="home-shell"><header className="home-header"><div className="brand-mark"><span>+</span> fixmate</div><nav><button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>Home</button><button className={view === 'plans' ? 'active' : ''} onClick={() => setView('plans')}>Plans</button><button className={view === 'profile' ? 'active' : ''} onClick={() => setView('profile')}>My profile</button><button className={view === 'bookings' ? 'active' : ''} onClick={() => setView('bookings')}>My bookings</button>{user.role === 'admin' && <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>Admin</button>}</nav><div className="header-actions"><button className="theme-toggle" onClick={() => setDarkMode(!darkMode)}>{darkMode ? '☼' : '◐'}</button><button className="icon-button" aria-label="Notifications">♧</button><button className="avatar-button" onClick={() => setView('profile')}><Avatar user={user} /></button><button className="logout-button" onClick={onLogout}>Log out</button></div></header>{view === 'profile' ? <ProfileView key={address.updatedAt || address.formatted || 'empty'} user={user} address={address} addressInput={addressInput} suggestions={suggestions} chooseAddress={chooseAddress} searchAddress={searchAddress} saveAddress={saveAddress} savingAddress={savingAddress} addressSaved={addressSaved} downloadProfile={downloadProfile} /> : view === 'plans' ? <PlansView user={user} startCheckout={startCheckout} message={message} checkoutLoading={checkoutLoading} /> : view === 'bookings' ? <BookingsView bookings={bookings} cancelBooking={cancelBooking} onBook={() => setBookingService('choose')} /> : view === 'admin' ? <AdminView /> : homeContent}{bookingService && <BookingModal service={bookingService} address={address} user={user} onClose={() => setBookingService(null)} onSubmit={createBooking} />}{message && <Toast message={message} onClose={() => setMessage('')} />}<Footer /></main>
}

function Toast({ message, onClose }) {
  return <div className="toast" role="status"><span className="toast-icon">✓</span><span>{message}</span><button aria-label="Dismiss notification" onClick={onClose}>×</button></div>
}

function Footer() {
  return <footer className="site-footer"><div className="footer-main"><div className="footer-brand"><div className="brand-mark"><span>+</span> fixmate</div><p>Reliable home care, thoughtfully delivered.</p></div><div className="footer-column"><strong>Services</strong><button>Cleaning</button><button>Repairs</button><button>Painting</button><button>Pest control</button></div><div className="footer-column"><strong>Support</strong><button>Help center</button><button>Contact us</button><button>Safety promise</button><button>Terms & privacy</button></div><div className="footer-contact"><strong>Need a hand?</strong><p>Our team is here to help you feel at home.</p><a href="mailto:hello@fixmate.local">hello@fixmate.local</a></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} FixMate. Built for better homes.</span><span>Trusted professionals · Clear pricing · Peace of mind</span></div></footer>
}

function AdminView() {
  const [users, setUsers] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [planStatus, setPlanStatus] = useState('')
  const token = localStorage.getItem('fixmate_token')

  const loadUsers = useCallback(async (page = 1) => {
    const params = new URLSearchParams({ page, limit: 10, search, role, planStatus })
    const response = await fetch(`${apiUrl}/api/admin/users?${params}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) return
    const data = await response.json(); setUsers(data.users); setPagination(data.pagination)
  }, [search, role, planStatus, token])
  // eslint-disable-next-line react/set-state-in-effect
  useEffect(() => { loadUsers(1) }, [loadUsers])

  return <section className="admin-page"><div className="admin-heading"><div><p className="eyebrow">PLATFORM CONTROL</p><h1>User management</h1><p>Review accounts, roles, and time-limited access plans.</p></div><div className="admin-total"><strong>{pagination.total}</strong><small>Total users</small></div></div><div className="admin-toolbar"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email..." /><select value={role} onChange={(event) => setRole(event.target.value)}><option value="">All roles</option><option value="customer">Customers</option><option value="admin">Admins</option></select><select value={planStatus} onChange={(event) => setPlanStatus(event.target.value)}><option value="">All plan statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Inactive</option></select></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>User</th><th>Role</th><th>Plan</th><th>Status</th><th>Expires</th><th>Joined</th></tr></thead><tbody>{users.map((listedUser) => <tr key={listedUser._id}><td><div className="admin-user"><Avatar user={listedUser} /><span><strong>{listedUser.name}</strong><small>{listedUser.email}</small></span></div></td><td><span className="role-pill">{listedUser.role}</span></td><td>{listedUser.planName || 'Free'}</td><td><span className={`admin-status ${listedUser.planStatus}`}>{listedUser.planStatus}</span></td><td>{listedUser.planExpiresAt ? new Date(listedUser.planExpiresAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td><td>{new Date(listedUser.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table>{!users.length && <div className="admin-empty">No users match these filters.</div>}</div><div className="pagination"><button disabled={pagination.page <= 1} onClick={() => loadUsers(pagination.page - 1)}>← Previous</button><span>Page {pagination.page} of {pagination.pages}</span><button disabled={pagination.page >= pagination.pages} onClick={() => loadUsers(pagination.page + 1)}>Next →</button></div></section>
}

function PlansView({ user, startCheckout, message, checkoutLoading }) {
  const plans = [{ id: 'free', label: 'Free', price: '₹0', detail: 'A simple start for every home', duration: '1 hour access', features: ['Browse trusted services', 'Standard support', 'Secure account'] }, { id: 'silver', label: 'Silver', price: '₹499', detail: 'More care, less waiting', duration: '6 hours access', features: ['Priority booking', 'Member pricing', 'Faster support'] }, { id: 'gold', label: 'Gold', price: '₹999', detail: 'The complete FixMate experience', duration: '12 hours access', features: ['Preferred professionals', 'Premium support', 'Best available access'] }]
  return <section className="plans-page"><div className="plans-heading"><p className="eyebrow">FLEXIBLE HOME CARE</p><h1>Choose your FixMate plan.</h1><p>Access is active for a set time, then automatically expires.</p>{message && <div className="dashboard-message">{message}</div>}</div><div className="plans-grid">{plans.map((plan) => <article className={`plan-card ${plan.id === 'silver' ? 'featured' : ''}`} key={plan.id}>{plan.id === 'silver' && <span className="popular-label">MOST POPULAR</span>}<p className="plan-kicker">{plan.label.toUpperCase()}</p><h2>{plan.price}<small> one-time</small></h2><p className="plan-detail">{plan.detail}<br /><b>{plan.duration}</b></p><ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>{user.accessLevel === plan.id && user.planStatus === 'active' ? <button className="current-plan" disabled>Active until {new Date(user.planExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</button> : <button className="dark-button plan-button" disabled={Boolean(checkoutLoading)} onClick={() => startCheckout(plan.id)}>{checkoutLoading === plan.id ? 'Opening Stripe...' : `Choose ${plan.label}`} <span>→</span></button>}</article>)}</div><p className="secure-note">Payments are processed securely by Stripe. Access activates after payment confirmation.</p></section>
}

function BookingsView({ bookings, cancelBooking, onBook }) {
  return <section className="bookings-page"><div className="bookings-heading"><div><p className="eyebrow">YOUR HOME CARE</p><h1>My bookings</h1><p>Track every service request in one place.</p></div><button className="dark-button" onClick={onBook}>Book a service <span>→</span></button></div>{bookings.length ? <div className="booking-history">{bookings.map((booking) => <article className="booking-row" key={booking._id}><span className="booking-service-icon">{booking.serviceIcon}</span><div className="booking-main"><div><strong>{booking.service}</strong><span className={`booking-status ${booking.status}`}>{booking.status.replace('_', ' ')}</span></div><p>{booking.requirement}</p><small>{new Date(booking.scheduledDate).toLocaleString()} · {booking.address}</small></div><div className="booking-meta"><b>{booking.priority} service</b>{['requested', 'confirmed'].includes(booking.status) && <button onClick={() => cancelBooking(booking._id)}>Cancel</button>}</div></article>)}</div> : <div className="empty-bookings"><span>✦</span><h2>Your service history is waiting.</h2><p>Book a trusted FixMate professional and your bookings will appear here.</p><button className="dark-button" onClick={onBook}>Find a service <span>→</span></button></div>}</section>
}

function BookingModal({ service, address, user, onClose, onSubmit }) {
  const [error, setError] = useState('')
  const [selectedService, setSelectedService] = useState(service === 'choose' ? '' : service)
  const [minimumDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 16))
  const submit = async (event) => {
    event.preventDefault(); setError('')
    const form = new FormData(event.currentTarget)
    try { await onSubmit({ service: selectedService, requirement: form.get('requirement'), scheduledDate: form.get('scheduledDate'), address: form.get('address') }) } catch (submissionError) { setError(submissionError.message) }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className={`booking-modal ${service === 'choose' ? 'service-picker-modal' : ''}`} onSubmit={submit}><button className="modal-close" type="button" onClick={onClose}>×</button>{service === 'choose' && !selectedService ? <><p className="eyebrow">FIXMATE SERVICES</p><h2>What can we help with?</h2><p className="muted-copy">Choose a service to get an instant booking slot.</p><div className="picker-grid">{categories.map((category) => <button type="button" className="picker-card" key={category.title} onClick={() => setSelectedService(category.title)}><img src={category.image} alt="" /><strong>{category.title}</strong><small>{category.detail}</small></button>)}</div></> : <><p className="eyebrow">BOOK A PROFESSIONAL</p><h2>{selectedService} service</h2><p className="muted-copy">Tell us what needs attention and we’ll match you with the right FixMate professional.</p><label>What do you need help with?<textarea name="requirement" placeholder="Describe the job, room, size, or anything we should know..." required maxLength="1000" /></label><label>Preferred date and time<input name="scheduledDate" type="datetime-local" min={minimumDate} required /></label><label>Service address<input name="address" defaultValue={address.formatted || ''} placeholder="Your service address" required /></label>{user.accessLevel === 'gold' && <p className="plan-hint">✦ Your Gold plan gives this request preferred professional matching.</p>}{user.accessLevel === 'silver' && <p className="plan-hint">✦ Your Silver plan gives this request priority handling.</p>}{error && <p className="modal-error">{error}</p>}<button className="primary-button" type="submit">Confirm {selectedService} booking <span>→</span></button></>}</form></div>
}

function ProfileView(props) {
  const { user } = props
  const active = user.planStatus === 'active' && user.planExpiresAt && new Date(user.planExpiresAt) > new Date()
  return <><section className="profile-plan-banner"><div className="plan-orbit">✦</div><div><p className="eyebrow">CURRENT ACCESS</p><h2>{user.planName || 'Free'} plan</h2><p>{active ? `Active until ${new Date(user.planExpiresAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : 'No active timed plan'}</p></div><span className={`plan-status ${active ? 'active' : 'inactive'}`}>{active ? 'Active' : 'Expired'}</span></section><ProfileAddressView {...props} /></>
}

function ProfileAddressView({ user, address, addressInput, suggestions, searchAddress, chooseAddress, saveAddress, savingAddress, addressSaved, downloadProfile }) {
  const [draftAddress, setDraftAddress] = useState(address)
  const updateField = (key, value) => setDraftAddress((current) => ({ ...current, [key]: value }))
  const submitAddress = (event) => saveAddress(event, draftAddress)
  return <section className="profile-page"><div className="profile-page-heading"><div><p className="eyebrow">ACCOUNT SETTINGS</p><h1>My profile</h1><p>Keep your details up to date so FixMate can serve you better.</p></div><div className="profile-heading-actions"><Avatar user={user} large /><button className="export-button" type="button" onClick={downloadProfile}>↓ Download PDF</button></div></div><div className="profile-grid"><form className="profile-form" onSubmit={submitAddress}><h2>Home address</h2><p className="muted-copy">We use this to find trusted professionals near you.</p><label>Address search<div className="suggestion-wrap"><input value={addressInput} onChange={(event) => searchAddress(event.target.value)} placeholder="Start typing your address" autoComplete="off" required />{suggestions.length > 0 && <div className="suggestions">{suggestions.map((suggestion) => <button type="button" key={suggestion.place_id} onClick={() => chooseAddress(suggestion)}>{suggestion.description}</button>)}</div>}</div></label><div className="address-fields"><label>City<input value={draftAddress.city || ''} onChange={(event) => updateField('city', event.target.value)} placeholder="City" /></label><label>State<input value={draftAddress.state || ''} onChange={(event) => updateField('state', event.target.value)} placeholder="State" /></label><label>Postal code<input value={draftAddress.postalCode || ''} onChange={(event) => updateField('postalCode', event.target.value)} placeholder="Postal code" /></label></div><button className="primary-button" type="submit">{savingAddress ? 'Saving...' : addressSaved ? '✓ Saved!' : 'Save address'} <span>→</span></button></form><div className="map-card"><div className="map-label"><span>⌖</span><div><strong>Your service location</strong><small>{draftAddress.formatted || 'Select an address to see it here'}</small></div></div><AddressMap latitude={draftAddress.latitude} longitude={draftAddress.longitude} label={draftAddress.formatted} /></div></div></section>
}


function Avatar({ user, large = false }) {
  return user.avatar?.url ? <img className={`avatar-image ${large ? 'large' : ''}`} src={user.avatar.url} alt={`${user.name} profile`} /> : <span className={`avatar-fallback ${large ? 'large' : ''}`}>{user.name.charAt(0).toUpperCase()}</span>
}

export default App
