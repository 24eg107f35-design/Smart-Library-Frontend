import { useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, BookOpen, LayoutDashboard, LibraryBig, LogOut, Search, UserRound } from 'lucide-react'
import { api } from './api/client'
import { authApi } from './api/auth'
import { apiError } from './api/client'
import { AdminCategories, AdminRequests, AdminTransactions, AdminUsers, BookDetails } from './AdminPages.jsx'

function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('smart-library-user') || 'null'))
  const [books, setBooks] = useState([])
  const [catalogError, setCatalogError] = useState('')
  const [pageInfo, setPageInfo] = useState({ page: 0, totalPages: 1, totalElements: 0 })
  const [categories, setCategories] = useState([])
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  async function loadBooks(search = '', options = {}) {
    setBusy(true)
    try {
      const { data } = await api.get('/books', { params: { search: search || undefined, size: 12, sort: 'title,asc', ...options } })
      setBooks(data.content || data)
      setCatalogError('')
      setPageInfo({ page: data.number || 0, totalPages: data.totalPages || 1, totalElements: data.totalElements ?? data.length ?? 0 })
    } catch (error) {
      setBooks([])
      setCatalogError('The catalog service is unavailable. Start the library API, then try again.')
    } finally { setBusy(false) }
  }

  useEffect(() => {
    loadBooks()
    api.get('/categories').then(({ data }) => setCategories(data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (user) authApi.me().then(({ data }) => {
      setUser(data); localStorage.setItem('smart-library-user', JSON.stringify(data))
    }).catch(() => {})
  }, [])

  function flash(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }

  async function login(credentials) {
    const { data } = await authApi.login(credentials)
    localStorage.setItem('smart-library-token', data.token)
    localStorage.setItem('smart-library-user', JSON.stringify(data.user))
    setUser(data.user)
    navigate(data.user.role === 'LIBRARIAN' ? '/librarian' : '/dashboard')
  }

  async function register(details) {
    await authApi.register(details)
    await login({ email: details.email, password: details.password })
  }

  function logout() {
    localStorage.removeItem('smart-library-token')
    localStorage.removeItem('smart-library-user')
    setUser(null)
    navigate('/')
  }

  async function borrow(bookId) {
    try {
      await api.post('/borrow-requests', { bookId })
      flash('Request sent to the library.')
    } catch (error) { flash(apiError(error)) }
  }

  const protectedPage = (roles, page) => user ? (roles.includes(user.role) ? page : <Navigate to="/" replace />) : <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <div className="app-shell">
    <header className="topbar">
      <Link to="/" className="brand"><span className="brand-mark"><BookOpen size={18} /></span><span>Common<span className="brand-light">/place</span></span></Link>
      <nav className="top-links"><Link to="/catalog">Catalog</Link>{user && <Link to={user.role === 'LIBRARIAN' ? '/librarian' : '/dashboard'}>Workspace</Link>}{user?.role === 'LIBRARIAN' && <Link to="/requests">Requests</Link>}{user?.role === 'STUDENT' && <Link to="/history">My loans</Link>}{!user && <Link to="/catalog">About</Link>}</nav>
      <div className="top-actions">{user ? <><span className="user-label"><UserRound size={15} />{user.fullName}</span><button className="icon-button" title="Sign out" onClick={logout}><LogOut size={17} /></button></> : <><Link to="/login" className="sign-in">Sign in</Link><Link to="/register" className="button button-dark">Join library <ArrowRight size={15} /></Link></>}</div>
    </header>
    <main>
      <Routes>
        <Route path="/" element={<Home books={books} busy={busy} catalogError={catalogError} />} />
        <Route path="/catalog" element={<Catalog books={books} categories={categories} busy={busy} pageInfo={pageInfo} catalogError={catalogError} onSearch={loadBooks} onBorrow={borrow} user={user} />} />
        <Route path="/books/:id" element={<BookDetails user={user} onBorrow={borrow} flash={flash} />} />
        <Route path="/login" element={user ? <Navigate to={user.role === 'LIBRARIAN' ? '/librarian' : '/dashboard'} replace /> : <AuthPage mode="login" onSubmit={login} />} />
        <Route path="/register" element={user ? <Navigate to={user.role === 'LIBRARIAN' ? '/librarian' : '/dashboard'} replace /> : <AuthPage mode="register" onSubmit={register} />} />
        <Route path="/dashboard" element={protectedPage(['STUDENT'], <StudentDashboard user={user} books={books} onBorrow={borrow} />)} />
        <Route path="/librarian" element={protectedPage(['LIBRARIAN'], <LibrarianDashboard books={books} categories={categories} reload={loadBooks} flash={flash} />)} />
        <Route path="/books/new" element={protectedPage(['LIBRARIAN'], <BookEditor categories={categories} onSaved={() => { loadBooks(); navigate('/librarian'); flash('Book added to the catalog.') }} />)} />
        <Route path="/books/:id/edit" element={protectedPage(['LIBRARIAN'], <BookEditor categories={categories} onSaved={() => { loadBooks(); navigate('/librarian'); flash('Book details updated.') }} />)} />
        <Route path="/requests" element={protectedPage(['LIBRARIAN'], <AdminRequests flash={flash} />)} />
        <Route path="/transactions" element={protectedPage(['LIBRARIAN'], <AdminTransactions flash={flash} />)} />
        <Route path="/users" element={protectedPage(['LIBRARIAN'], <AdminUsers flash={flash} />)} />
        <Route path="/categories" element={protectedPage(['LIBRARIAN'], <AdminCategories flash={flash} />)} />
        <Route path="/history" element={protectedPage(['STUDENT','LIBRARIAN'], <HistoryPage />)} />
        <Route path="*" element={<div className="empty-state"><h2>Page not found</h2><Link to="/catalog">Browse the catalog</Link></div>} />
      </Routes>
    </main>
    <footer className="footer"><span>COMMON/PLACE LIBRARY</span><span>Read widely. Return kindly.</span><span>Open every day · 8am—8pm</span></footer>
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>
}

function Home({ books, busy, catalogError }) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const featured = books.slice(0, 3)
  return <>
    <section className="hero">
      <div className="hero-copy"><p className="eyebrow"><span className="live-dot" /> YOUR NEIGHBORHOOD LIBRARY, ONLINE</p><h1>A little more<br />room to <em>think.</em></h1><p className="hero-sub">Find your next favorite, keep track of what you borrow, and make space for good ideas.</p><form className="search-box hero-search" onSubmit={(e) => { e.preventDefault(); navigate('/catalog', { state: { search: query } }) }}><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="A title, an author, an idea..." /><button aria-label="Search catalog"><ArrowRight size={18} /></button></form><div className="hero-meta"><span>01 / A PLACE FOR EVERY STORY</span><span>SCROLL TO EXPLORE ↓</span></div></div>
      <div className="hero-art" aria-label="Illustrated still life of books"><div className="art-note">A GOOD BOOK<br />IS A DOOR.</div><div className="sun-disc" /><div className="book-stack"><div className="book book-one"><i>FIELD<br />NOTES</i><small>ON BEING HUMAN</small></div><div className="book book-two"><i>THE<br />LONG WAY<br />HOME</i></div><div className="book book-three"><i>things<br />we grow</i></div><div className="book book-four"><i>OTHER<br />WORLDS</i></div></div><div className="art-floor" /><span className="art-caption">THE READING ROOM · EST. 1984</span></div>
    </section>
    <section className="section-block new-books"><div className="section-heading"><div><p className="eyebrow">A FEW GOOD PLACES TO START</p><h2>Recently on the shelves</h2></div><Link to="/catalog" className="text-link">See all books <ArrowRight size={15} /></Link></div>{busy ? <p className="muted">Finding the shelves...</p> : <BookRow books={featured} error={catalogError} />}</section>
    <section className="quote-band"><span className="quote-mark">“</span><p>Reading is an exercise in empathy; an exercise in walking in someone else’s shoes for a while.</p><span className="quote-by">— MALORIE BLACKMAN</span></section>
  </>
}

function Catalog({ books, categories, busy, pageInfo, catalogError, onSearch, onBorrow, user }) {
  const location = useLocation()
  const [query, setQuery] = useState(location.state?.search || '')
  const [category, setCategory] = useState('')
  const [available, setAvailable] = useState(false)
  const [sort, setSort] = useState('title,asc')
  useEffect(() => { if (location.state?.search) onSearch(location.state.search, { page: 0 }) }, [])
  function searchPage(page = 0, overrides = {}) {
    onSearch(query, { page, sort, ...(category ? { categoryId: category } : {}), ...(available ? { available: true } : {}), ...overrides })
  }
  return <section className="page-wrap"><div className="page-intro"><p className="eyebrow">THE COLLECTION</p><h1>Find something<br /><em>worth keeping.</em></h1><p>Browse the shelves by title, author, ISBN, or category.</p></div><div className="catalog-tools"><form className="search-box" onSubmit={(e) => { e.preventDefault(); searchPage(0) }}><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search books, authors, ISBN..." /><button aria-label="Search"><ArrowRight size={18} /></button></form><select aria-label="Filter category" value={category} onChange={(e) => { setCategory(e.target.value); searchPage(0, { categoryId: e.target.value || undefined }) }}><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}</select><select aria-label="Sort catalog" value={sort} onChange={(e) => { setSort(e.target.value); searchPage(0, { sort: e.target.value }) }}><option value="title,asc">Title A–Z</option><option value="title,desc">Title Z–A</option><option value="author,asc">Author A–Z</option><option value="publicationYear,desc">Newest first</option></select><label className="check-filter"><input type="checkbox" checked={available} onChange={(e) => { setAvailable(e.target.checked); searchPage(0, { available: e.target.checked ? true : undefined }) }} /> Available now</label></div><div className="catalog-count">{pageInfo.totalElements} TITLES <span>{busy ? 'UPDATING...' : `PAGE ${pageInfo.page + 1} OF ${pageInfo.totalPages}`}</span></div>{catalogError ? <div className="inline-empty" role="status">{catalogError}</div> : <BookGrid books={books} onBorrow={onBorrow} user={user} />}<div className="pagination"><button disabled={pageInfo.page < 1 || busy || Boolean(catalogError)} onClick={() => searchPage(pageInfo.page - 1)}>← Previous</button><span>{pageInfo.page + 1} / {pageInfo.totalPages}</span><button disabled={pageInfo.page + 1 >= pageInfo.totalPages || busy || Boolean(catalogError)} onClick={() => searchPage(pageInfo.page + 1)}>Next →</button></div></section>
}

function BookGrid({ books, onBorrow, user }) {
  return books.length ? <div className="book-grid">{books.map((book, index) => <article className="book-card" key={book.id}><Link to={`/books/${book.id}`} aria-label={`View ${book.title}`}><div className={`cover cover-${index % 6}`}><span>{book.category?.name || 'THE COLLECTION'}</span><strong>{book.title}</strong><i>{book.author}</i><b>COMMON/PLACE</b></div></Link><div className="book-info"><div><h3><Link to={`/books/${book.id}`}>{book.title}</Link></h3><p>{book.author}</p></div><span className={`availability ${book.availableCopies > 0 ? 'in-stock' : 'out-stock'}`}>{book.availableCopies > 0 ? `${book.availableCopies} available` : 'Checked out'}</span></div><div className="book-card-actions"><span>ISBN {book.isbn}</span>{user?.role === 'STUDENT' && book.availableCopies > 0 && <button onClick={() => onBorrow(book.id)}>Request <ArrowRight size={14} /></button>}{user?.role === 'LIBRARIAN' && <Link to={`/books/${book.id}/edit`}>Edit</Link>}</div></article>)}</div> : <div className="empty-state"><LibraryBig size={26} /><h2>No books found</h2><p>Try another title or clear your filters.</p></div>
}

function BookRow({ books, error }) { return error ? <div className="inline-empty">{error}</div> : <div className="book-row">{books.length ? books.map((book, index) => <article className="row-book" key={book.id}><div className={`mini-cover cover-${index % 6}`}><span>{book.category?.name || 'READ'}</span><strong>{book.title}</strong></div><div><p className="row-author">{book.author}</p><p className="row-title">{book.title}</p><span className="availability in-stock">{book.availableCopies > 0 ? 'Available' : 'On loan'}</span></div><ArrowRight size={17} /></article>) : <p className="muted">No catalog entries yet. Check back soon.</p>}</div> }

function AuthPage({ mode, onSubmit }) {
  const [values, setValues] = useState({ fullName: '', email: '', password: '', role: 'STUDENT', inviteCode: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(event) {
    event.preventDefault(); setError(''); setLoading(true)
    try { await onSubmit(values) } catch (err) { setError(apiError(err)) } finally { setLoading(false) }
  }
  return <section className="auth-layout"><div className="auth-aside"><p className="eyebrow">A LIBRARY CARD, REIMAGINED</p><h1>Make room<br />for a <em>new chapter.</em></h1><p>Your reading life, gathered in one thoughtful place.</p><div className="auth-stamp">C / P<br /><small>MEMBER</small></div></div><form className="auth-form" onSubmit={submit}><p className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'START HERE'}</p><h2>{mode === 'login' ? 'Sign in' : 'Create your account'}</h2><p className="form-intro">{mode === 'login' ? 'Pick up right where you left off.' : 'Join the library and find your next read.'}</p>{mode === 'register' && <><label>Full name<input required minLength="2" maxLength="120" value={values.fullName} onChange={(e) => setValues({ ...values, fullName: e.target.value })} autoComplete="name" /></label><label>Account type<select value={values.role} onChange={(e) => setValues({ ...values, role: e.target.value })}><option value="STUDENT">Student</option><option value="LIBRARIAN">Librarian</option></select></label>{values.role === 'LIBRARIAN' && <label>Staff invitation code<input type="password" required maxLength="120" value={values.inviteCode} onChange={(e) => setValues({ ...values, inviteCode: e.target.value })} autoComplete="one-time-code" /></label>}</>}<label>Email address<input type="email" required value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} autoComplete="email" /></label><label>Password<input type="password" required minLength="8" value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-dark submit-button" disabled={loading}>{loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}<ArrowRight size={16} /></button><p className="form-switch">{mode === 'login' ? <>New around here? <Link to="/register">Make an account</Link></> : <>Already a member? <Link to="/login">Sign in</Link></>}</p></form></section>
}

function StudentDashboard({ user, books, onBorrow }) {
  const [loans, setLoans] = useState([])
  const [requests, setRequests] = useState([])
  const [stats, setStats] = useState(null)
  const [dashboardError, setDashboardError] = useState('')
  useEffect(() => {
    Promise.all([api.get('/transactions/mine'), api.get('/borrow-requests/mine'), api.get('/dashboard/student')])
      .then(([loanResult, requestResult, statsResult]) => { setLoans(loanResult.data); setRequests(requestResult.data); setStats(statsResult.data) })
      .catch((error) => setDashboardError(apiError(error)))
  }, [])
  const current = loans.filter((item) => !item.returnDate)
  return <section className="page-wrap"><div className="dashboard-welcome"><div><p className="eyebrow">YOUR READING DESK</p><h1>Good to see you, {user.fullName.split(' ')[0]}.</h1><p>Keep your place, then find somewhere new to wander.</p></div><Link to="/catalog" className="button button-dark">Browse the catalog <ArrowRight size={15} /></Link></div>{dashboardError && <div className="inline-empty" role="alert">{dashboardError}</div>}<div className="stats-grid"><Stat label="ON YOUR SHELF" value={current.length} note="active loans" icon={<BookOpen />} /><Stat label="AVAILABLE TITLES" value={stats?.availableBooks ?? books.length} note="ready to borrow" icon={<LibraryBig />} /><Stat label="PAST DUE" value={current.filter((item) => item.dueDate < new Date().toISOString().slice(0, 10)).length} note="please return soon" icon={<LayoutDashboard />} /></div><div className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">CURRENTLY YOURS</p><h2>Your borrowed books</h2></div><Link to="/history" className="text-link">Full history <ArrowRight size={15} /></Link></div>{current.length ? <TransactionTable items={current} /> : <div className="inline-empty">No books checked out. A good place to start is <Link to="/catalog">the catalog</Link>.</div>}</div><div className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">WAITING ON THE DESK</p><h2>Your borrow requests</h2></div></div>{requests.length ? <div className="table-wrap"><table><thead><tr><th>Book</th><th>Requested</th><th>Status</th></tr></thead><tbody>{requests.map((item) => <tr key={item.id}><td>{item.book.title}<small>{item.book.author}</small></td><td>{item.requestedAt.slice(0,10)}</td><td><span className={`status ${item.status === 'APPROVED' ? 'status-open' : item.status === 'REJECTED' ? 'status-late' : ''}`}>{item.status}</span></td></tr>)}</tbody></table></div> : <div className="inline-empty">No borrow requests yet.</div>}</div><div className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">WHEN YOU'RE READY</p><h2>Something to read next</h2></div></div><BookRow books={books.slice(0, 3)} /></div></section>
}

function LibrarianDashboard({ books, categories, reload, flash }) {
  const [requests, setRequests] = useState([])
  const [transactions, setTransactions] = useState([])
  const [stats, setStats] = useState(null)
  useEffect(() => { Promise.all([api.get('/borrow-requests'), api.get('/transactions'), api.get('/dashboard/librarian')]).then(([a,b,c]) => { setRequests(a.data); setTransactions(b.data); setStats(c.data) }).catch((error) => flash(apiError(error))) }, [])
  async function refreshStats() { try { const { data } = await api.get('/dashboard/librarian'); setStats(data) } catch (error) { flash(apiError(error)) } }
  async function resolveRequest(id, approve) {
    try { await api.patch(`/borrow-requests/${id}`, { status: approve ? 'APPROVED' : 'REJECTED' }); const { data } = await api.get('/borrow-requests'); setRequests(data); reload(); refreshStats(); flash(approve ? 'Request approved and book issued.' : 'Request declined.') } catch (error) { flash(apiError(error)) }
  }
  async function returnBook(id) {
    try { await api.post(`/transactions/${id}/return`); const { data } = await api.get('/transactions'); setTransactions(data); reload(); refreshStats(); flash('Book returned and availability updated.') } catch (error) { flash(apiError(error)) }
  }
  const active = transactions.filter((item) => !item.returnDate)
  const overdue = active.filter((item) => item.dueDate < new Date().toISOString().slice(0,10))
  return <section className="page-wrap"><div className="dashboard-welcome"><div><p className="eyebrow">LIBRARY OPERATIONS</p><h1>The reading room.</h1><p>A clear view of the shelves and the people using them.</p></div><Link to="/books/new" className="button button-dark">＋ Add a book</Link></div><nav className="manage-links" aria-label="Library management"><Link to="/requests">Borrow requests <ArrowRight size={14} /></Link><Link to="/transactions">Issue & return <ArrowRight size={14} /></Link><Link to="/categories">Categories <ArrowRight size={14} /></Link><Link to="/users">Members <ArrowRight size={14} /></Link><Link to="/history">Borrowing history <ArrowRight size={14} /></Link></nav><div className="stats-grid librarian-stats"><Stat label="TOTAL TITLES" value={stats?.totalBooks ?? books.length} note="in the catalog" icon={<BookOpen />} /><Stat label="AVAILABLE TITLES" value={stats?.availableBooks ?? books.length} note="with copies ready" icon={<LibraryBig />} /><Stat label="ON LOAN" value={stats?.issuedBooks ?? active.length} note="active transactions" icon={<LayoutDashboard />} /><Stat label="OVERDUE" value={stats?.overdueBooks ?? overdue.length} note="needs attention" icon={<UserRound />} /></div><section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">NEEDS YOUR ATTENTION</p><h2>Borrow requests <span className="count-badge">{requests.filter((item) => item.status === 'PENDING').length}</span></h2></div><Link to="/catalog" className="text-link">Catalog <ArrowRight size={15} /></Link></div>{requests.filter((item) => item.status === 'PENDING').length ? <div className="table-wrap"><table><thead><tr><th>Reader</th><th>Book</th><th>Requested</th><th>Action</th></tr></thead><tbody>{requests.filter((item) => item.status === 'PENDING').map((request) => <tr key={request.id}><td>{request.user?.fullName}<small>{request.user?.email}</small></td><td>{request.book?.title}<small>{request.book?.author}</small></td><td>{request.requestedAt?.slice(0,10)}</td><td className="action-cell"><button className="small-action approve" onClick={() => resolveRequest(request.id,true)}>Approve</button><button className="small-action decline" onClick={() => resolveRequest(request.id,false)}>Decline</button></td></tr>)}</tbody></table></div> : <div className="inline-empty">There are no requests waiting for review.</div>}</section><section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">OUT IN THE WORLD</p><h2>Active loans</h2></div><span className="muted">{categories.length} categories</span></div>{active.length ? <div className="table-wrap"><table><thead><tr><th>Reader</th><th>Book</th><th>Due date</th><th>Status</th><th></th></tr></thead><tbody>{active.map((item) => <tr key={item.id}><td>{item.user?.fullName}<small>{item.user?.email}</small></td><td>{item.book?.title}<small>{item.book?.author}</small></td><td>{item.dueDate}</td><td><span className={`status ${item.dueDate < new Date().toISOString().slice(0,10) ? 'status-late' : 'status-open'}`}>{item.dueDate < new Date().toISOString().slice(0,10) ? 'Overdue' : 'On loan'}</span></td><td><button className="small-action approve" onClick={() => returnBook(item.id)}>Process return</button></td></tr>)}</tbody></table></div> : <div className="inline-empty">No active loans.</div>}</section></section>
}

function BookEditor({ categories, onSaved }) {
  const { id } = useParams()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState({ isbn:'', title:'', author:'', publisher:'', publicationYear:'', totalCopies:1, categoryId:'', description:'' })
  useEffect(() => {
    if (id) api.get(`/books/${id}`).then(({ data }) => setValues({ ...data, categoryId: String(data.category.id), publicationYear: data.publicationYear || '' })).catch((err) => setError(apiError(err)))
  }, [id])
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('')
    try { const payload = { ...values, publicationYear: values.publicationYear ? Number(values.publicationYear) : null, totalCopies: Number(values.totalCopies), categoryId: Number(values.categoryId) }; if (id) await api.put(`/books/${id}`, payload); else await api.post('/books', payload); onSaved() }
    catch (err) { setError(apiError(err)) } finally { setSaving(false) }
  }
  const update = (key) => (event) => setValues({ ...values, [key]: event.target.value })
  return <section className="page-wrap narrow-wrap"><Link to="/librarian" className="back-link">← Back to operations</Link><p className="eyebrow">GROW THE COLLECTION</p><h1>{id ? 'Edit book' : 'Add a book'}</h1><p className="page-lede">A few details to help someone find it later.</p><form className="book-form" onSubmit={submit}><div className="form-grid"><label>Title<input required maxLength="180" value={values.title} onChange={update('title')} /></label><label>Author<input required maxLength="140" value={values.author} onChange={update('author')} /></label><label>ISBN<input required maxLength="20" value={values.isbn} onChange={update('isbn')} /></label><label>Publisher<input maxLength="140" value={values.publisher} onChange={update('publisher')} /></label><label>Category<select required value={values.categoryId} onChange={update('categoryId')}><option value="">Choose a category</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Publication year<input type="number" min="1000" max="2100" value={values.publicationYear} onChange={update('publicationYear')} /></label><label>Copies<input type="number" min="1" max="1000" required value={values.totalCopies} onChange={update('totalCopies')} /></label><label className="wide-field">Description<textarea rows="4" maxLength="2000" value={values.description} onChange={update('description')} /></label></div>{error && <p className="form-error">{error}</p>}<button className="button button-dark" disabled={saving}>{saving ? 'Saving...' : id ? 'Save changes' : 'Add to collection'} <ArrowRight size={15} /></button></form></section>
}

function HistoryPage() {
  const [loans, setLoans] = useState([])
  const [error, setError] = useState('')
  useEffect(() => { api.get('/transactions/mine').then(({ data }) => setLoans(data)).catch((err) => setError(apiError(err))) }, [])
  return <section className="page-wrap"><div className="page-intro compact-intro"><p className="eyebrow">YOUR READING RECORD</p><h1>Borrowing history</h1><p>A record of books borrowed and returned.</p></div>{error ? <div className="inline-empty">{error}</div> : loans.length ? <TransactionTable items={loans} /> : <div className="inline-empty">Your borrowing history will appear here.</div>}</section>
}

function TransactionTable({ items }) { return <div className="table-wrap"><table><thead><tr><th>Book</th><th>Issued</th><th>Due</th><th>Returned</th><th>Status</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.book?.title}<small>{item.book?.author}</small></td><td>{item.issueDate}</td><td>{item.dueDate}</td><td>{item.returnDate || '—'}</td><td><span className={`status ${item.returnDate ? 'status-returned' : item.dueDate < new Date().toISOString().slice(0,10) ? 'status-late' : 'status-open'}`}>{item.returnDate ? 'Returned' : item.dueDate < new Date().toISOString().slice(0,10) ? 'Overdue' : 'On loan'}</span></td></tr>)}</tbody></table></div> }

function Stat({ label, value, note, icon }) { return <article className="stat"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong>{value}</strong><small>{note}</small></article> }

export default App
