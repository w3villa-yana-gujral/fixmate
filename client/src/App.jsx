import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import AddressMap from './AddressMap.jsx'
import './App.css'
import './profile.css'
import './modern.css'
import './theme.css'

const apiUrl = import.meta.env.VITE_API_URL || 'https://fixmate-lilac.vercel.app'
const HomeScene = lazy(() => import('./HomeScene.jsx'))

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
  { icon: '⌂', title: 'Cleaning', detail: 'Home refresh', startingPrice: 2999, color: 'sage', image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80' },
  { icon: '⌁', title: 'Plumbing', detail: 'Fix a leak', startingPrice: 1499, color: 'blue', image: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=600&q=80' },
  { icon: '✦', title: 'Electrical', detail: 'Power & lights', startingPrice: 1799, color: 'gold', image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=600&q=80' },
  { icon: '◒', title: 'Appliances', detail: 'Keep it running', startingPrice: 1999, color: 'rose', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80' },
  { icon: '⌘', title: 'Carpentry', detail: 'Build & repair', startingPrice: 2499, color: 'wood', image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80' },
  { icon: '◈', title: 'Painting', detail: 'Refresh a room', startingPrice: 3499, color: 'gold', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&q=80' },
  { icon: '◎', title: 'Pest control', detail: 'Protect your home', startingPrice: 1999, color: 'rose', image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80' },
  { icon: '▣', title: 'Moving', detail: 'Make a move easier', startingPrice: 5999, color: 'blue', image: 'https://images.unsplash.com/photo-1600518464441-9154a4dea21b?auto=format&fit=crop&w=600&q=80' }
]
const planDiscounts = { free: 0, silver: 0.05, gold: 0.1 }
const cancellationReasons = [
  { value: 'schedule_conflict', label: 'My schedule changed' },
  { value: 'no_longer_needed', label: 'I no longer need this service' },
  { value: 'booked_by_mistake', label: 'I booked the wrong service or time' },
  { value: 'found_another_provider', label: 'I chose another provider' },
  { value: 'price_concern', label: 'The price does not work for me' },
  { value: 'other', label: 'Other reason' }
]
const formatPrice = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
const priceFor = (service, accessLevel = 'free') => {
  const startingPrice = categories.find((category) => category.title === service)?.startingPrice || 0
  const discount = planDiscounts[accessLevel] || 0
  return { startingPrice, discount, memberPrice: Math.round(startingPrice * (1 - discount)) }
}
const activePlanLevel = (user) => user?.planStatus === 'active' && user.planExpiresAt && new Date(user.planExpiresAt) > new Date() ? user.accessLevel || 'free' : 'free'

function tiltServiceCard(event) {
  const card = event.currentTarget
  const bounds = card.getBoundingClientRect()
  const horizontal = (event.clientX - bounds.left) / bounds.width
  const vertical = (event.clientY - bounds.top) / bounds.height
  card.style.setProperty('--card-rotate-y', `${(horizontal - 0.5) * 12}deg`)
  card.style.setProperty('--card-rotate-x', `${(0.5 - vertical) * 10}deg`)
}

function resetServiceCard(event) {
  event.currentTarget.style.removeProperty('--card-rotate-y')
  event.currentTarget.style.removeProperty('--card-rotate-x')
}

function App() {
  const queryToken = new URLSearchParams(window.location.search).get('token')
  const [token, setToken] = useState(() => queryToken || localStorage.getItem('fixmate_token'))
  const [user, setUser] = useState(null)
  const [showAuth, setShowAuth] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return Boolean(params.get('verification') || params.get('socialError'))
  })
  const [pendingAction, setPendingAction] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fixmate_pending_action') || 'null') } catch { return null }
  })
  const [publicView, setPublicView] = useState('home')
  const [mode, setMode] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('verification') ? 'login' : 'signup'
  })
  const [showPassword, setShowPassword] = useState(false)
  const [submitted, setSubmitted] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return Boolean(params.get('verification') || params.get('socialError'))
  })
  const [message, setMessage] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const verification = params.get('verification')
    if (verification) return verification === 'success' ? 'Email verified successfully. You can now log in.' : 'This verification link is invalid or expired.'
    const socialError = params.get('socialError')
    const messages = {
      google_not_configured: 'Google sign-in is not configured on this server yet.',
      facebook_not_configured: 'Facebook sign-in is not configured on this server yet.',
      google: 'Google sign-in failed. Please try again.',
      facebook: 'Facebook sign-in failed. Please try again.',
      google_missing_email: 'Google account has no email address available.',
      facebook_missing_email: 'Facebook account has no email address available.'
    }
    return messages[socialError] || (socialError ? 'Social sign-in failed.' : '')
  })
  const [bookingPaymentUpdate, setBookingPaymentUpdate] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  useEffect(() => {
    document.documentElement.dataset.theme = 'light'
    localStorage.removeItem('fixmate_theme')
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('verification') || params.has('socialError') || params.has('reset_token')) window.history.replaceState({}, '', window.location.pathname)
    if (queryToken) {
      localStorage.setItem('fixmate_token', queryToken)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [queryToken])

  useEffect(() => {
    if (!token) return
    fetch(`${apiUrl}/api/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() })
      .then((data) => { setUser(data.user); setShowAuth(false) })
      .catch(() => { localStorage.removeItem('fixmate_token'); setToken(null); setUser(null) })
  }, [token])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    if (params.get('payment') === 'cancelled') {
      setMessage(params.get('checkout_type') === 'booking' ? 'Payment was cancelled. Your service has not been booked.' : 'Plan payment was cancelled.')
      window.history.replaceState({}, '', window.location.pathname)
      return
    }
    if (params.get('payment') !== 'success' || !sessionId || !token) return
    fetch(`${apiUrl}/api/payments/session-status?session_id=${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Could not verify payment.'); return data })
      .then((data) => {
        if (params.get('checkout_type') === 'booking') {
          if (data.booking) {
            setBookingPaymentUpdate((value) => value + 1)
            setMessage(`${data.booking.service} payment received. Your booking is confirmed.`)
          } else setMessage('Your booking payment is still processing.')
        } else if (data.user) {
          setUser(data.user)
          setMessage(`${data.user.planName} is now active on your account.`)
        }
      })
      .catch((error) => setMessage(error.message))
    window.history.replaceState({}, '', window.location.pathname)
  }, [token])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = formData.get('email')
    const payload = { name: formData.get('name'), email, password: formData.get('password'), rememberMe }
    try {
      const response = await fetch(`${apiUrl}/api/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setMessage(data.message)
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

  const requireAuth = (action = null) => {
    if (action) {
      localStorage.setItem('fixmate_pending_action', JSON.stringify(action))
      setPendingAction(action)
    } else {
      localStorage.removeItem('fixmate_pending_action')
      setPendingAction(null)
    }
    setMode('signup')
    setSubmitted(false)
    setShowAuth(true)
  }

  const goPublicHome = () => {
    localStorage.removeItem('fixmate_pending_action')
    setPendingAction(null)
    setShowAuth(false)
    setPublicView('home')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (token && user) return <Dashboard user={user} setUser={setUser} pendingAction={pendingAction} bookingPaymentUpdate={bookingPaymentUpdate} message={message} setMessage={setMessage} uploadAvatar={uploadAvatar} uploading={uploading} onHome={() => window.scrollTo({ top: 0, behavior: 'smooth' })} onLogout={() => { localStorage.removeItem('fixmate_token'); localStorage.removeItem('fixmate_pending_action'); setPendingAction(null); setToken(null); setUser(null) }} />

  if (!showAuth) return <PublicHome view={publicView} setView={setPublicView} requireAuth={requireAuth} onHome={goPublicHome} onLogin={() => { setMode('login'); setSubmitted(false); setShowAuth(true) }} />

  return <main className="auth-shell">
    <section className="brand-panel"><button type="button" className="brand-mark" aria-label="FixMate home" onClick={goPublicHome}><span>+</span> fixmate</button><div className="brand-copy"><p className="eyebrow">HOME CARE, MADE SIMPLE</p><h1>Good help is<br /><em>closer</em> than you think.</h1><p className="intro">From a dripping tap to a deep clean, find trusted professionals who treat your home like their own.</p></div><div className="service-note"><span className="spark">✦</span><span><strong>Trusted by 12,000+ homes</strong><br />across your neighborhood</span></div><div className="curve curve-one" /><div className="curve curve-two" /></section>
    <section className="form-panel"><button className="public-back-button" onClick={goPublicHome}>← Back to home</button><div className="form-inner"><button type="button" className="mobile-brand brand-mark" aria-label="FixMate home" onClick={goPublicHome}><span>+</span> fixmate</button><div className="topline"><span>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</span></div><h2>{mode === 'signup' ? <>Let’s get you <em>home.</em></> : <>Welcome <em>home.</em></>}</h2><p className="form-subtitle">{mode === 'signup' ? 'Join FixMate and make your home feel effortless.' : 'Sign in to manage your home services.'}</p><div className="mode-switch" role="tablist"><button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setSubmitted(false) }}>Sign up</button><button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setSubmitted(false) }}>Log in</button></div>
      <form onSubmit={handleSubmit}>{mode === 'signup' && <label>Full name<input name="name" type="text" placeholder="e.g. Maya Patel" required /></label>}<label>Email address<input name="email" type="email" placeholder="you@example.com" required /></label><label>Password<div className="password-input"><input name="password" type={showPassword ? 'text' : 'password'} placeholder="At least 8 characters" minLength="8" required /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></div></label>{mode === 'signup' && <label className="check-row"><input type="checkbox" required /><span>I agree to the <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a></span></label>}{mode === 'login' && <label className="check-row"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span>Remember me</span></label>}{submitted && <p className="success-message">{message}</p>}<button className="primary-button" type="submit">{mode === 'signup' ? 'Create my account' : 'Log in to FixMate'} <span>→</span></button></form>
      <><div className="divider"><span>or continue with</span></div><div className="social-row"><a href={`${apiUrl}/api/auth/google`}><b className="google">G</b> Google</a><a href={`${apiUrl}/api/auth/facebook`}><b className="facebook">f</b> Facebook</a></div><p className="fine-print">{mode === 'signup' ? 'Already have an account?' : 'New to FixMate?'} <button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setSubmitted(false) }}>{mode === 'signup' ? 'Log in' : 'Create an account'}</button></p></>
    </div></section>
  </main>
}

function Dashboard({ user, setUser, pendingAction, bookingPaymentUpdate, message, setMessage, uploadAvatar, uploading, onHome, onLogout }) {
  const firstName = user.name.split(' ')[0]
  const [view, setView] = useState(() => pendingAction?.type === 'bookings' ? 'bookings' : pendingAction?.type === 'profile' ? 'profile' : ['plans', 'checkout'].includes(pendingAction?.type) ? 'plans' : user.role === 'admin' ? 'admin' : 'home')
  const [address, setAddress] = useState(user.address || {})
  const [addressInput, setAddressInput] = useState(user.address?.formatted || '')
  const [suggestions, setSuggestions] = useState([])
  const searchTimeoutRef = useRef()
  const searchAbortRef = useRef()
  const [savingAddress, setSavingAddress] = useState(false)
  const [addressSaved, setAddressSaved] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState('')
  const [bookings, setBookings] = useState([])
  const [bookingService, setBookingService] = useState(() => pendingAction?.type === 'booking' ? pendingAction.service || 'choose' : null)

  useEffect(() => {
    if (!message) return undefined
    const timeout = window.setTimeout(() => setMessage(''), 4500)
    return () => window.clearTimeout(timeout)
  }, [message, setMessage])

  useEffect(() => {
    fetch(`${apiUrl}/api/bookings`, { headers: { Authorization: `Bearer ${localStorage.getItem('fixmate_token')}` } })
      .then((response) => response.json()).then((data) => setBookings(data.bookings || []))
  }, [bookingPaymentUpdate])

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

  const downloadProfile = () => {
    try {
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const left = 18
      const right = pageWidth - left
      const profileAddress = address || {}
      const displayDate = (value) => value && !Number.isNaN(new Date(value).getTime())
        ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'Not provided'
      const field = (label, value, x, y, width) => {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        pdf.setTextColor(103, 120, 110)
        pdf.text(label, x, y)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10)
        pdf.setTextColor(36, 49, 45)
        const lines = pdf.splitTextToSize(String(value || 'Not provided'), width)
        pdf.text(lines, x, y + 6)
        return Math.max(1, lines.length) * 5
      }

      pdf.setFillColor(23, 62, 56)
      pdf.rect(0, 0, pageWidth, 40, 'F')
      pdf.setTextColor(228, 185, 94)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(20)
      pdf.text('+', left, 20)
      pdf.setTextColor(248, 244, 233)
      pdf.setFontSize(18)
      pdf.text('fixmate', left + 9, 20)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(215, 228, 218)
      pdf.text(`Exported ${displayDate(new Date())}`, left, 31)

      pdf.setTextColor(36, 49, 45)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(19)
      pdf.text('Profile information', left, 55)

      const section = (title, y) => {
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(9)
        pdf.setTextColor(22, 112, 116)
        pdf.text(title.toUpperCase(), left, y)
        pdf.setDrawColor(215, 224, 216)
        pdf.line(left, y + 3, right, y + 3)
      }

      section('Account details', 69)
      field('Full name', user.name, left, 79, 78)
      field('Email address', user.email, 108, 79, 84)
      field('Account type', user.role === 'admin' ? 'Administrator' : 'Homeowner', left, 98, 78)
      field('Email status', user.isVerified ? 'Verified' : 'Not verified', 108, 98, 84)
      field('Member since', displayDate(user.createdAt), left, 117, 90)

      section('Home address', 139)
      const fullAddress = profileAddress.formatted || profileAddress.line1
      const addressHeight = field('Address', fullAddress, left, 149, right - left)
      const locationY = 149 + addressHeight + 8
      field('City', profileAddress.city, left, locationY, 52)
      field('State', profileAddress.state, 78, locationY, 52)
      field('Postal code', profileAddress.postalCode, 138, locationY, 54)
      field('Country', profileAddress.country, left, locationY + 19, 90)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(123, 135, 127)
      pdf.text('Profile details as currently saved in FixMate.', left, 278)
      pdf.save(`fixmate-profile-${user._id || 'account'}.pdf`)
    } catch (error) {
      setMessage(error.message || 'Could not download your profile.')
    }
  }

  const startCheckout = useCallback(async (plan) => {
    setCheckoutLoading(plan); setMessage(`Opening ${plan === 'plus' ? 'Plus' : 'Pro'} checkout...`)
    try {
      const response = await fetch(`${apiUrl}/api/payments/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('fixmate_token')}` }, body: JSON.stringify({ plan }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Unable to start checkout.')
      if (data.user) { setUser(data.user); setMessage(`${data.user.planName} is active until ${new Date(data.user.planExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`); setCheckoutLoading(''); return }
      if (!data.url) throw new Error('Stripe did not return a checkout URL.')
      window.location.href = data.url
    } catch (error) { setCheckoutLoading(''); setMessage(error.message || 'Stripe is unavailable. Check that the API is running.') }
  }, [setMessage, setUser])

  useEffect(() => {
    if (pendingAction?.type !== 'checkout' || !pendingAction.plan) return undefined
    const timeout = window.setTimeout(() => startCheckout(pendingAction.plan), 0)
    return () => window.clearTimeout(timeout)
  }, [pendingAction, startCheckout])

  useEffect(() => { localStorage.removeItem('fixmate_pending_action') }, [])

  const createBooking = async (payload) => {
    const response = await fetch(`${apiUrl}/api/bookings`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('fixmate_token')}` }, body: JSON.stringify(payload) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Could not create booking.')
    if (!data.url) throw new Error('The payment provider did not return a checkout link.')
    window.location.href = data.url
  }

  const cancelBooking = async (id, cancellation) => {
    const response = await fetch(`${apiUrl}/api/bookings/${id}/cancel`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('fixmate_token')}` }, body: JSON.stringify(cancellation) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Could not cancel this booking.')
    setBookings((current) => current.map((booking) => booking._id === id ? data.booking : booking))
    setMessage(data.message || 'Booking cancelled.')
    return data.booking
  }

  const homeExtras = <section className="home-content-extended"><div className="steps-heading"><p className="eyebrow">WHY FIXMATE</p><h2>Home care that feels effortless.</h2></div><div className="spotlight-strip">{categories.slice(0, 3).map((category) => <article className="spotlight-card" key={category.title}><img src={category.image} alt="" /><div className="spotlight-copy"><small>Popular this week</small><strong>{category.title} made simple</strong></div></article>)}</div><div className="metrics-strip"><div className="metric-item"><span>✦</span><div><strong>12k+</strong><small>happy homes served</small></div></div><div className="metric-item"><span>◷</span><div><strong>45 min</strong><small>average arrival time</small></div></div><div className="metric-item"><span>★</span><div><strong>4.9/5</strong><small>trusted service rating</small></div></div></div><div className="steps-section"><div className="steps-heading"><p className="eyebrow">HOW IT WORKS</p><h2>From request to done.</h2></div><div className="steps-grid"><article className="step-card" onPointerMove={tiltServiceCard} onPointerLeave={resetServiceCard}><span className="step-number">01</span><strong>Choose a service</strong><p>Tell us what your home needs and pick a time that works for you.</p></article><article className="step-card" onPointerMove={tiltServiceCard} onPointerLeave={resetServiceCard}><span className="step-number">02</span><strong>Meet a trusted pro</strong><p>We match your request with a verified professional nearby.</p></article><article className="step-card" onPointerMove={tiltServiceCard} onPointerLeave={resetServiceCard}><span className="step-number">03</span><strong>Enjoy your space</strong><p>Track the booking, get clear updates, and settle in comfortably.</p></article></div></div></section>

  const homeContent = <><section className="welcome-row"><div><p className="eyebrow">YOUR HOME, YOUR WAY</p><h1>Good morning, {firstName}<span>.</span></h1><p>What can we help you take care of today?</p></div><div className="profile-upload"><Avatar user={user} large /><label className="upload-button">{uploading ? 'Uploading...' : '+ Add photo'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} disabled={uploading} /></label></div></section>{message && <p className="dashboard-message">{message}</p>}<section className="dashboard-content"><div className="main-column"><div className="section-heading"><div><p className="eyebrow">EXPLORE SERVICES</p><h2>Make home feel easy.</h2></div><button className="text-button" onClick={() => setBookingService('choose')}>Explore all services <span>→</span></button></div><p className="service-discount-note">Each service is paid separately. Silver saves 5%; Gold saves 10%.</p><ServiceMarquee accessLevel={activePlanLevel(user)} onSelect={(service) => setBookingService(service)} /><div className="booking-banner"><div><p className="eyebrow">NEED A HAND?</p><h3>Book your next service<br />in a few simple steps.</h3><button className="dark-button" onClick={() => setBookingService('choose')}>Browse all services <span>→</span></button></div><div className="banner-mark">⌂</div></div></div><aside className="side-column"><div className="side-heading"><h3>Your activity</h3><button className="text-button" onClick={() => setView('bookings')}>See all</button></div>{bookings.length ? <div className="activity-list">{bookings.slice(0, 3).map((booking) => <div className="activity-item" key={booking._id}><span>{booking.serviceIcon}</span><div><strong>{booking.service}</strong><small>{new Date(booking.scheduledDate).toLocaleDateString()}</small></div><b>{booking.status.replaceAll('_', ' ')}</b></div>)}</div> : <div className="empty-activity"><span>✦</span><strong>No bookings yet</strong><p>Your next home improvement<br />story starts here.</p><button className="outline-button" onClick={() => setBookingService('choose')}>Find a service</button></div>}<div className="trust-card"><span>✦</span><div><strong>FixMate promise</strong><p>Trusted pros, clear pricing,<br />peace of mind.</p></div></div></aside></section>{homeExtras}</>
  return <main className="home-shell"><header className="home-header"><button type="button" className="brand-mark" aria-label="FixMate home" onClick={() => { setView('home'); onHome() }}><span>+</span> fixmate</button><nav><button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>Home</button><button className={view === 'plans' ? 'active' : ''} onClick={() => setView('plans')}>Plans</button><button className={view === 'profile' ? 'active' : ''} onClick={() => setView('profile')}>My profile</button><button className={view === 'bookings' ? 'active' : ''} onClick={() => setView('bookings')}>My bookings</button>{user.role === 'admin' && <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>Admin</button>}</nav><div className="header-actions"><button className="icon-button" aria-label="Notifications">♧</button><button className="avatar-button" onClick={() => setView('profile')}><Avatar user={user} /></button><button className="logout-button" onClick={onLogout}>Log out</button></div></header>{view === 'profile' ? <ProfileView key={address.updatedAt || address.formatted || 'empty'} user={user} address={address} addressInput={addressInput} suggestions={suggestions} chooseAddress={chooseAddress} searchAddress={searchAddress} saveAddress={saveAddress} savingAddress={savingAddress} addressSaved={addressSaved} downloadProfile={downloadProfile} /> : view === 'plans' ? <PlansView user={user} startCheckout={startCheckout} message={message} checkoutLoading={checkoutLoading} /> : view === 'bookings' ? <BookingsView bookings={bookings} cancelBooking={cancelBooking} onBook={() => setBookingService('choose')} /> : view === 'admin' ? <AdminView /> : homeContent}{bookingService && <BookingModal service={bookingService} address={address} user={user} onClose={() => setBookingService(null)} onSubmit={createBooking} />}{message && <Toast message={message} onClose={() => setMessage('')} />}<Footer onHome={() => { setView('home'); onHome() }} /></main>
}

function Toast({ message, onClose }) {
  return <div className="toast" role="status"><span className="toast-icon">✓</span><span>{message}</span><button aria-label="Dismiss notification" onClick={onClose}>×</button></div>
}

function PublicHome({ view, setView, requireAuth, onHome, onLogin }) {
  const book = (service = 'choose') => requireAuth({ type: 'booking', service })
  return <main className="home-shell public-home">
    <header className="home-header">
      <button type="button" className="brand-mark" aria-label="FixMate home" onClick={onHome}><span>+</span> fixmate</button>
      <nav>
        <button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>Home</button>
        <button onClick={() => { setView('home'); window.setTimeout(() => document.getElementById('public-services')?.scrollIntoView({ behavior: 'smooth' }), 0) }}>Services</button>
        <button className={view === 'plans' ? 'active' : ''} onClick={() => setView('plans')}>Plans</button>
        <button onClick={() => requireAuth({ type: 'bookings' })}>My bookings</button>
      </nav>
      <div className="header-actions">
        <button className="public-login" onClick={onLogin}>Log in</button>
        <button className="dark-button public-header-cta" onClick={() => requireAuth()}>Get started <span>→</span></button>
      </div>
    </header>
    {view === 'plans' ? <PlansView onRequireAuth={(plan) => requireAuth({ type: 'checkout', plan })} /> : <>
      <section className="public-hero">
        <div className="public-hero-copy">
          <p className="eyebrow">HOME CARE, MADE SIMPLE</p>
          <h1>Good help is <em>closer</em> than you think.</h1>
          <p>From a dripping tap to a deep clean, find trusted professionals who treat your home like their own.</p>
          <div className="public-hero-actions">
            <button className="dark-button" onClick={() => book()}>Book a service <span>→</span></button>
            <button className="public-secondary-button" onClick={() => document.getElementById('public-services')?.scrollIntoView({ behavior: 'smooth' })}>View services</button>
          </div>
          <div className="public-trust-note"><span>✦</span><strong>Trusted by 12,000+ homes</strong><small>across your neighborhood</small></div>
        </div>
        <div className="public-hero-visual"><Suspense fallback={<div className="home-scene-fallback" />}><HomeScene /></Suspense></div>
      </section>
      <section id="public-services" className="public-services">
          <div className="section-heading">
          <div><p className="eyebrow">EXPLORE SERVICES</p><h2>Make home feel easy.</h2></div>
          <button className="text-button" onClick={() => book()}>Book a service <span>→</span></button>
        </div>
          <p className="service-discount-note">Each service is paid separately. Silver saves 5%; Gold saves 10%.</p>
        <ServiceMarquee onSelect={book} />
        <div className="public-booking-banner">
          <div>
            <p className="eyebrow">YOUR HOME, YOUR WAY</p>
            <h2>Trusted help for every little fix.</h2>
            <p>Choose a service, tell us what you need, and we’ll take it from there.</p>
            <button className="dark-button" onClick={() => book()}>Get started <span>→</span></button>
          </div>
          <div className="public-banner-image"><img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=85" alt="A welcoming home interior" /></div>
        </div>
        <section className="public-how">
          <p className="eyebrow">HOW IT WORKS</p><h2>From request to done.</h2>
          <div className="steps-grid">
            <article className="step-card" onPointerMove={tiltServiceCard} onPointerLeave={resetServiceCard}><span className="step-number">01</span><strong>Choose a service</strong><p>Tell us what your home needs and pick a time that works for you.</p></article>
            <article className="step-card" onPointerMove={tiltServiceCard} onPointerLeave={resetServiceCard}><span className="step-number">02</span><strong>Meet a trusted pro</strong><p>We match your request with a verified professional nearby.</p></article>
            <article className="step-card" onPointerMove={tiltServiceCard} onPointerLeave={resetServiceCard}><span className="step-number">03</span><strong>Enjoy your space</strong><p>Track the booking, get clear updates, and settle in comfortably.</p></article>
          </div>
        </section>
      </section>
    </>}
    <Footer onHome={onHome} />
  </main>
}

function ServiceMarquee({ onSelect, accessLevel = 'free' }) {
  const rows = [categories.filter((_, index) => index % 2 === 0), categories.filter((_, index) => index % 2 === 1)]
  return <div className="service-marquee" aria-label="Available home services">
    {rows.map((services, row) => <div className={`service-marquee-row row-${row + 1}`} key={row}>
      <div className="service-marquee-track">
        {[false, true].map((duplicate) => <div className="service-marquee-group" key={String(duplicate)} aria-hidden={duplicate || undefined}>
          {services.map((category) => <button className="service-slide-card" key={category.title} tabIndex={duplicate ? -1 : undefined} onPointerMove={tiltServiceCard} onPointerLeave={resetServiceCard} onBlur={resetServiceCard} onClick={() => onSelect(category.title)}>
            <img src={category.image} alt="" />
            <span className={`service-slide-icon ${category.color}`}>{category.icon}</span>
            <span className="service-slide-copy"><strong>{category.title}</strong><small>{category.detail}</small></span>
            <ServicePrice service={category.title} accessLevel={accessLevel} />
            <span className="service-slide-action" aria-hidden="true">↗</span>
          </button>)}
        </div>)}
      </div>
    </div>)}
  </div>
}

function ServicePrice({ service, accessLevel = 'free' }) {
  const { startingPrice, discount, memberPrice } = priceFor(service, accessLevel)
  return <span className="service-price">
    <small>Starts at</small>
    <span className="service-price-amount">
      {discount > 0 && <s>{formatPrice(startingPrice)}</s>}
      <strong>{formatPrice(discount > 0 ? memberPrice : startingPrice)}</strong>
    </span>
    {discount > 0 && <small className="service-discount-label">{accessLevel === 'gold' ? 'Gold saves 10%' : 'Silver saves 5%'}</small>}
  </span>
}

function Footer({ onHome }) {
  return <footer className="site-footer"><div className="footer-main"><div className="footer-brand"><button type="button" className="brand-mark" aria-label="FixMate home" onClick={onHome}><span>+</span> fixmate</button><p>Reliable home care, thoughtfully delivered.</p></div><div className="footer-column"><strong>Services</strong><button>Cleaning</button><button>Repairs</button><button>Painting</button><button>Pest control</button></div><div className="footer-column"><strong>Support</strong><button>Help center</button><button>Contact us</button><button>Safety promise</button><button>Terms & privacy</button></div><div className="footer-contact"><strong>Need a hand?</strong><p>Our team is here to help you feel at home.</p><a href="mailto:hello@fixmate.local">hello@fixmate.local</a></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} FixMate. Built for better homes.</span><span>Trusted professionals · Clear pricing · Peace of mind</span></div></footer>
}

function AdminView() {
  const [users, setUsers] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [planStatus, setPlanStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const token = localStorage.getItem('fixmate_token')

  const loadUsers = useCallback(async (page = 1) => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page, limit: 10, search, role, planStatus })
    try {
      const response = await fetch(`${apiUrl}/api/admin/users?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Could not load users.')
      setUsers(data.users)
      setPagination(data.pagination)
    } catch (loadError) {
      setError(loadError.message || 'Could not load users.')
    } finally {
      setLoading(false)
    }
  }, [search, role, planStatus, token])
  // eslint-disable-next-line react/set-state-in-effect
  useEffect(() => { loadUsers(1) }, [loadUsers])

  const activePlansOnPage = users.filter((listedUser) => listedUser.planStatus === 'active').length

  return <section className="admin-page">
    <div className="admin-heading">
      <div><p className="eyebrow">PLATFORM CONTROL</p><h1>User management</h1><p>Review accounts, roles, and time-limited access plans.</p></div>
      <div className="admin-total"><strong>{pagination.total}</strong><small>Matching users</small></div>
    </div>
    <div className="admin-metrics" aria-label="User management summary">
      <div><span aria-hidden="true">◎</span><strong>{pagination.total}</strong><small>Matching users</small></div>
      <div><span aria-hidden="true">▤</span><strong>{users.length}</strong><small>Shown on this page</small></div>
      <div><span aria-hidden="true">✓</span><strong>{activePlansOnPage}</strong><small>Active plans on page</small></div>
    </div>
    <div className="admin-toolbar">
      <input aria-label="Search users" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email..." />
      <select aria-label="Filter by role" value={role} onChange={(event) => setRole(event.target.value)}><option value="">All roles</option><option value="customer">Customers</option><option value="admin">Admins</option></select>
      <select aria-label="Filter by plan status" value={planStatus} onChange={(event) => setPlanStatus(event.target.value)}><option value="">All plan statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Inactive</option></select>
    </div>
    {error && <div className="admin-error" role="alert"><span>{error}</span><button onClick={() => loadUsers(pagination.page)}>Try again</button></div>}
    <div className="admin-table-wrap" aria-busy={loading}>
      <table className="admin-table">
        <thead><tr><th>User</th><th>Role</th><th>Plan</th><th>Status</th><th>Expires</th><th>Joined</th></tr></thead>
        <tbody>
          {users.map((listedUser) => <tr key={listedUser._id}><td><div className="admin-user"><Avatar user={listedUser} /><span><strong>{listedUser.name}</strong><small>{listedUser.email}</small></span></div></td><td><span className="role-pill">{listedUser.role}</span></td><td>{listedUser.planName || 'Free'}</td><td><span className={`admin-status ${listedUser.planStatus}`}>{listedUser.planStatus}</span></td><td>{listedUser.planExpiresAt ? new Date(listedUser.planExpiresAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td><td>{new Date(listedUser.createdAt).toLocaleDateString()}</td></tr>)}
          {loading && <tr><td className="admin-table-message" colSpan="6">Loading user accounts...</td></tr>}
          {!loading && !error && !users.length && <tr><td className="admin-table-message" colSpan="6">No users match these filters.</td></tr>}
        </tbody>
      </table>
    </div>
    <div className="pagination"><button disabled={loading || pagination.page <= 1} onClick={() => loadUsers(pagination.page - 1)}>← Previous</button><span>Page {pagination.page} of {pagination.pages}</span><button disabled={loading || pagination.page >= pagination.pages} onClick={() => loadUsers(pagination.page + 1)}>Next →</button></div>
  </section>
}

function PlansView({ user, startCheckout, message, checkoutLoading, onRequireAuth }) {
  const plans = [{ id: 'free', label: 'Free', price: '₹0', detail: 'A simple start for every home', duration: '1 hour access', features: ['Browse trusted services', 'Pay per booking', 'Standard support'] }, { id: 'silver', label: 'Silver', price: '₹499', detail: 'More care, less waiting', duration: '6 hours access', features: ['Priority booking', '5% off each service', 'Faster support'] }, { id: 'gold', label: 'Gold', price: '₹999', detail: 'The complete FixMate experience', duration: '12 hours access', features: ['Preferred professionals', '10% off each service', 'Premium support'] }]
  return <section className="plans-page"><div className="plans-heading"><p className="eyebrow">FLEXIBLE HOME CARE</p><h1>Choose your FixMate plan.</h1><p>Access is active for a set time, then automatically expires.</p>{message && <div className="dashboard-message">{message}</div>}</div><div className="plans-grid">{plans.map((plan) => <article className={`plan-card ${plan.id === 'silver' ? 'featured' : ''}`} key={plan.id}>{plan.id === 'silver' && <span className="popular-label">MOST POPULAR</span>}<p className="plan-kicker">{plan.label.toUpperCase()}</p><h2>{plan.price}<small> one-time</small></h2><p className="plan-detail">{plan.detail}<br /><b>{plan.duration}</b></p><ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>{user?.accessLevel === plan.id && user.planStatus === 'active' ? <button className="current-plan" disabled>Active until {new Date(user.planExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</button> : <button className="dark-button plan-button" disabled={Boolean(checkoutLoading)} onClick={() => onRequireAuth ? onRequireAuth(plan.id) : startCheckout(plan.id)}>{checkoutLoading === plan.id ? 'Opening Stripe...' : `${onRequireAuth ? 'Choose' : 'Choose'} ${plan.label}`} <span>→</span></button>}</article>)}</div><p className="secure-note">Payments are processed securely by Stripe. Access activates after payment confirmation.</p></section>
}

function BookingsView({ bookings, cancelBooking, onBook }) {
  const [cancellingBooking, setCancellingBooking] = useState(null)
  const dueCount = bookings.filter((booking) => booking.paymentStatus !== 'paid' && booking.status !== 'cancelled').length
  const paidCount = bookings.filter((booking) => booking.paymentStatus === 'paid').length
  const totalPaid = bookings.reduce((total, booking) => total + (booking.paymentStatus === 'paid' ? booking.amountPaid || 0 : 0), 0)

  return <section className="bookings-page">
    <div className="bookings-heading">
      <div><p className="eyebrow">YOUR HOME CARE</p><h1>My bookings</h1><p>Track service details, payment, and appointment timing.</p></div>
      <button className="dark-button" onClick={onBook}>Book a service <span>→</span></button>
    </div>
    {bookings.length > 0 && <div className="booking-overview" aria-label="Booking summary">
      <div><span>Total bookings</span><strong>{bookings.length}</strong></div>
      <div><span>Paid</span><strong>{paidCount}</strong></div>
      <div className={dueCount ? 'has-due' : ''}><span>Payment due</span><strong>{dueCount}</strong></div>
      <div><span>Total paid</span><strong>{formatPrice(totalPaid)}</strong></div>
    </div>}
    {bookings.length ? <div className="booking-history">
      {bookings.map((booking) => {
        const status = booking.status.replaceAll('_', ' ')
        const isPaid = booking.paymentStatus === 'paid'
        const isCancelled = booking.status === 'cancelled'
        const hasAmount = Number.isFinite(isPaid ? booking.amountPaid : booking.amountDue) && (isPaid || !isCancelled)
        const amount = isPaid ? booking.amountPaid : booking.amountDue
        const canCancel = ['pending_payment', 'requested', 'confirmed'].includes(booking.status)
        return <article className="booking-row" key={booking._id}>
          <span className="booking-service-icon" aria-hidden="true">{booking.serviceIcon}</span>
          <div className="booking-main">
            <div className="booking-title-line"><strong>{booking.service}</strong><span className={`booking-status ${booking.status}`}>{status}</span></div>
            <p>{booking.requirement}</p>
            <div className="booking-details"><span><b>When</b>{new Date(booking.scheduledDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span><span><b>Address</b>{booking.address}</span></div>
          </div>
          <div className="booking-meta">
            <span className={`booking-payment ${isPaid ? 'paid' : isCancelled ? 'cancelled' : 'due'}`}>{isPaid ? 'Paid' : isCancelled ? 'Not charged' : 'Payment due'}</span>
            {hasAmount && <strong className="booking-amount">{formatPrice(amount)}</strong>}
            <span className="booking-priority">{booking.priority} service</span>
            {canCancel && <button className="booking-cancel" onClick={() => setCancellingBooking(booking)}>Cancel booking</button>}
            {isCancelled && booking.cancellationReason && <span className="booking-cancel-reason">Reason: {cancellationReasons.find((option) => option.value === booking.cancellationReason)?.label || booking.cancellationReason}{booking.cancellationDetails ? ` · ${booking.cancellationDetails}` : ''}</span>}
          </div>
        </article>
      })}
    </div> : <div className="empty-bookings"><span>✦</span><h2>Your service history is waiting.</h2><p>Book a trusted FixMate professional and your bookings will appear here.</p><button className="dark-button" onClick={onBook}>Find a service <span>→</span></button></div>}
    {cancellingBooking && <CancelBookingDialog booking={cancellingBooking} onClose={() => setCancellingBooking(null)} onConfirm={async (cancellation) => {
      await cancelBooking(cancellingBooking._id, cancellation)
      setCancellingBooking(null)
    }} />}
  </section>
}

function CancelBookingDialog({ booking, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onConfirm({ reason, details: reason === 'other' ? details : '' })
    } catch (cancelError) {
      setError(cancelError.message || 'Could not cancel this booking.')
      setSubmitting(false)
    }
  }

  return <div className="modal-backdrop cancellation-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}>
    <form className="booking-modal cancellation-dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="cancel-booking-title">
      <button className="modal-close" type="button" onClick={onClose} disabled={submitting} aria-label="Close cancellation dialog">×</button>
      <p className="eyebrow">CANCEL SERVICE</p>
      <h2 id="cancel-booking-title">Cancel {booking.service} booking?</h2>
      <p className="muted-copy">Choose the reason that best describes your cancellation.</p>
      <fieldset className="cancellation-reasons">
        <legend>Reason for cancelling</legend>
        {cancellationReasons.map((option) => <label className={reason === option.value ? 'selected' : ''} key={option.value}>
          <input type="radio" name="cancellationReason" value={option.value} checked={reason === option.value} onChange={() => setReason(option.value)} required />
          <span>{option.label}</span>
        </label>)}
      </fieldset>
      {reason === 'other' && <label className="cancellation-details-label">Tell us a little more<textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={500} required placeholder="Your reason (up to 500 characters)" /></label>}
      {booking.paymentStatus === 'paid' && <p className="cancellation-no-refund">This booking will be cancelled, but payment already made is not refundable.</p>}
      {error && <p className="modal-error" role="alert">{error}</p>}
      <div className="cancellation-actions"><button className="outline-button" type="button" onClick={onClose} disabled={submitting}>Keep booking</button><button className="primary-button cancel-confirm-button" type="submit" disabled={!reason || (reason === 'other' && !details.trim()) || submitting}>{submitting ? 'Cancelling...' : 'Confirm cancellation'}</button></div>
    </form>
  </div>
}

function BookingModal({ service, address, user, onClose, onSubmit }) {
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedService, setSelectedService] = useState(service === 'choose' ? '' : service)
  const [minimumDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 16))
  const accessLevel = activePlanLevel(user)
  const submit = async (event) => {
    event.preventDefault(); setError('')
    const form = new FormData(event.currentTarget)
    setSubmitting(true)
    try { await onSubmit({ service: selectedService, requirement: form.get('requirement'), scheduledDate: form.get('scheduledDate'), address: form.get('address') }) } catch (submissionError) { setError(submissionError.message); setSubmitting(false) }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className={`booking-modal ${service === 'choose' ? 'service-picker-modal' : ''}`} onSubmit={submit}>
      <button className="modal-close" type="button" onClick={onClose}>×</button>
      {service === 'choose' && !selectedService ? <>
        <p className="eyebrow">FIXMATE SERVICES</p>
        <h2>What can we help with?</h2>
        <p className="muted-copy">Choose a service to get an instant booking slot.</p>
        <div className="picker-grid">{categories.map((category) => <button type="button" className="picker-card" key={category.title} onClick={() => setSelectedService(category.title)}>
          <img src={category.image} alt="" />
          <strong>{category.title}</strong>
          <small>{category.detail}</small>
          <ServicePrice service={category.title} accessLevel={accessLevel} />
        </button>)}</div>
      </> : <>
        <p className="eyebrow">BOOK A PROFESSIONAL</p>
        <h2>{selectedService} service</h2>
        <p className="muted-copy">Tell us what needs attention and we’ll match you with the right FixMate professional.</p>
        <div className="booking-price-summary"><ServicePrice service={selectedService} accessLevel={accessLevel} /><small>This plan-adjusted service price is charged now to confirm the booking.</small></div>
        <label>What do you need help with?<textarea name="requirement" placeholder="Describe the job, room, size, or anything we should know..." required maxLength="1000" /></label>
        <label>Preferred date and time<input name="scheduledDate" type="datetime-local" min={minimumDate} required /></label>
        <label>Service address<input name="address" defaultValue={address.formatted || ''} placeholder="Your service address" required /></label>
        {accessLevel === 'gold' && <p className="plan-hint">✦ Your Gold plan includes preferred professional matching and 10% off this service.</p>}
        {accessLevel === 'silver' && <p className="plan-hint">✦ Your Silver plan includes priority handling and 5% off this service.</p>}
        {error && <p className="modal-error">{error}</p>}
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Opening secure payment...' : `Pay ${formatPrice(priceFor(selectedService, accessLevel).memberPrice)} and book`} <span>→</span></button>
      </>}
    </form>
  </div>
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
