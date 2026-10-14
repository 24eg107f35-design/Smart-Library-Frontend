import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, BookOpen, Users } from 'lucide-react'
import { api, apiError } from './api/client'

export function BookDetails({ user, onBorrow, flash }) {
  const { id } = useParams()
  const [book, setBook] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.get(`/books/${id}`).then(({ data }) => setBook(data)).catch((err) => setError(apiError(err))) }, [id])
  if (error) return <section className="page-wrap"><p className="form-error">{error}</p><Link to="/catalog">Return to catalog</Link></section>
  if (!book) return <section className="page-wrap"><p className="muted">Loading book details...</p></section>
  return <section className="page-wrap detail-layout"><div className="detail-cover"><div className="cover cover-2"><span>{book.category?.name}</span><strong>{book.title}</strong><i>{book.author}</i><b>COMMON/PLACE</b></div></div><div className="detail-copy"><Link className="back-link" to="/catalog">← Back to catalog</Link><p className="eyebrow">{book.category?.name?.toUpperCase()}</p><h1>{book.title}</h1><p className="detail-author">{book.author}</p><p className="detail-description">{book.description || 'A new addition to the Common/Place collection.'}</p><dl className="book-facts"><div><dt>ISBN</dt><dd>{book.isbn}</dd></div><div><dt>PUBLISHER</dt><dd>{book.publisher || 'Not listed'}</dd></div><div><dt>YEAR</dt><dd>{book.publicationYear || 'Not listed'}</dd></div><div><dt>AVAILABILITY</dt><dd>{book.availableCopies} of {book.totalCopies} copies</dd></div></dl>{user?.role === 'STUDENT' && book.availableCopies > 0 && <button className="button button-dark" onClick={() => onBorrow(book.id)}>Request this book <ArrowRight size={15} /></button>}{user?.role === 'LIBRARIAN' && <div className="detail-actions"><Link className="button button-dark" to={`/books/${book.id}/edit`}>Edit book</Link><button className="small-action decline" onClick={async () => { if (!window.confirm('Delete this book from the catalog?')) return; try { await api.delete(`/books/${book.id}`); window.location.assign('/catalog') } catch (err) { flash(apiError(err)) } }}>Delete book</button></div>}</div></section>
}

export function AdminRequests({ flash }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  async function refresh() { try { const { data } = await api.get('/borrow-requests'); setRequests(data) } catch (err) { flash(apiError(err)) } finally { setLoading(false) } }
  useEffect(() => { refresh() }, [])
  async function resolve(item, status) {
    try { await api.patch(`/borrow-requests/${item.id}`, { status }); flash(status === 'APPROVED' ? 'Request approved and book issued.' : 'Request declined.'); refresh() }
    catch (err) { flash(apiError(err)) }
  }
  return <ManagementLayout eyebrow="READER SERVICES" title="Borrow requests" subtitle="Review requests and issue approved books."><div className="catalog-count">{requests.filter((item) => item.status === 'PENDING').length} WAITING FOR REVIEW<span>{requests.length} TOTAL</span></div>{loading ? <p className="muted">Loading requests...</p> : requests.length ? <div className="table-wrap"><table><thead><tr><th>Reader</th><th>Book</th><th>Requested</th><th>Status</th><th>Decision</th></tr></thead><tbody>{requests.map((item) => <tr key={item.id}><td>{item.user.fullName}<small>{item.user.email}</small></td><td>{item.book.title}<small>{item.book.author}</small></td><td>{item.requestedAt.slice(0,10)}</td><td>{item.status}</td><td>{item.status === 'PENDING' ? <><button className="small-action approve" onClick={() => resolve(item,'APPROVED')}>Approve</button><button className="small-action decline" onClick={() => resolve(item,'REJECTED')}>Decline</button></> : '—'}</td></tr>)}</tbody></table></div> : <div className="inline-empty">No borrow requests yet.</div>}</ManagementLayout>
}

export function AdminTransactions({ flash }) {
  const [transactions, setTransactions] = useState([])
  const [books, setBooks] = useState([])
  const [users, setUsers] = useState([])
  const [issue, setIssue] = useState({ userId:'', bookId:'' })
  const [error, setError] = useState('')
  async function refresh() { try { const { data } = await api.get('/transactions'); setTransactions(data) } catch (err) { flash(apiError(err)) } }
  useEffect(() => { Promise.all([api.get('/books',{params:{size:100}}),api.get('/users')]).then(([b,u]) => { setBooks(b.data.content || b.data); setUsers(u.data) }).catch((err) => setError(apiError(err))); refresh() }, [])
  async function issueBook(event) { event.preventDefault(); setError(''); try { await api.post('/transactions/issue',{userId:Number(issue.userId),bookId:Number(issue.bookId)}); setIssue({userId:'',bookId:''}); flash('Book issued and due date recorded.'); refresh() } catch(err) { setError(apiError(err)) } }
  async function returnBook(id) { try { await api.post(`/transactions/${id}/return`); flash('Return recorded.'); refresh() } catch(err) { flash(apiError(err)) } }
  return <ManagementLayout eyebrow="CIRCULATION DESK" title="Issue & return" subtitle="Record a direct issue or process an item coming back."><form className="issue-form" onSubmit={issueBook}><label>Reader<select required value={issue.userId} onChange={(e) => setIssue({...issue,userId:e.target.value})}><option value="">Select reader</option>{users.filter((item) => item.role === 'STUDENT').map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.email}</option>)}</select></label><label>Book<select required value={issue.bookId} onChange={(e) => setIssue({...issue,bookId:e.target.value})}><option value="">Select available book</option>{books.filter((item) => item.availableCopies > 0).map((item) => <option key={item.id} value={item.id}>{item.title} · {item.availableCopies} available</option>)}</select></label><button className="button button-dark">Issue book <ArrowRight size={15} /></button></form>{error && <p className="form-error">{error}</p>}<div className="section-heading management-subheading"><div><p className="eyebrow">THE CIRCULATION LEDGER</p><h2>Recent transactions</h2></div></div>{transactions.length ? <div className="table-wrap"><table><thead><tr><th>Reader</th><th>Book</th><th>Issued</th><th>Due</th><th>Returned</th><th>Action</th></tr></thead><tbody>{transactions.map((item) => <tr key={item.id}><td>{item.user.fullName}<small>{item.user.email}</small></td><td>{item.book.title}</td><td>{item.issueDate}</td><td>{item.dueDate}</td><td>{item.returnDate || '—'}</td><td>{item.returnDate ? 'Complete' : <button className="small-action approve" onClick={() => returnBook(item.id)}>Process return</button>}</td></tr>)}</tbody></table></div> : <div className="inline-empty">No transactions have been recorded.</div>}</ManagementLayout>
}

export function AdminUsers({ flash }) {
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  useEffect(() => { api.get('/users').then(({ data }) => setUsers(data)).catch((err) => setError(apiError(err))) }, [])
  return <ManagementLayout eyebrow="MEMBERSHIP" title="Library members" subtitle="Registered readers and library staff.">{error && <p className="form-error">{error}</p>}<div className="catalog-count">{users.length} REGISTERED USERS<span>{users.filter((item) => item.role === 'LIBRARIAN').length} LIBRARIANS</span></div><div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Member since</th></tr></thead><tbody>{users.map((item) => <tr key={item.id}><td>{item.fullName}</td><td>{item.email}</td><td><span className="status status-open">{item.role}</span></td><td>{item.createdAt?.slice(0,10) || '—'}</td></tr>)}</tbody></table></div></ManagementLayout>
}

export function AdminCategories({ flash }) {
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({name:'',description:''})
  const [error, setError] = useState('')
  async function refresh() { try { const { data } = await api.get('/categories'); setCategories(data) } catch (err) { setError(apiError(err)) } }
  useEffect(() => { refresh() }, [])
  async function create(event) { event.preventDefault(); setError(''); try { await api.post('/categories',form); setForm({name:'',description:''}); refresh(); flash('Category created.') } catch(err) { setError(apiError(err)) } }
  async function remove(item) { if (!window.confirm(`Delete category “${item.name}”?`)) return; try { await api.delete(`/categories/${item.id}`); refresh(); flash('Category deleted.') } catch(err) { setError(apiError(err)) } }
  return <ManagementLayout eyebrow="COLLECTION TAXONOMY" title="Book categories" subtitle="Keep browsing subjects clear and easy to navigate."><form className="category-form" onSubmit={create}><label>Category name<input required maxLength="80" value={form.name} onChange={(e) => setForm({...form,name:e.target.value})} /></label><label>Description<input maxLength="500" value={form.description} onChange={(e) => setForm({...form,description:e.target.value})} /></label><button className="button button-dark">Add category <ArrowRight size={15} /></button></form>{error && <p className="form-error">{error}</p>}<div className="category-list">{categories.map((item) => <article key={item.id}><div><BookOpen size={16} /><strong>{item.name}</strong><span>{item.description}</span></div><button className="small-action decline" onClick={() => remove(item)}>Delete</button></article>)}</div></ManagementLayout>
}

function ManagementLayout({ eyebrow, title, subtitle, children }) { return <section className="page-wrap management-page"><Link className="back-link" to="/librarian">← Back to operations</Link><div className="page-intro compact-intro"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{subtitle}</p></div>{children}</section> }
