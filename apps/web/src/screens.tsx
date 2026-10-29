import React, { useState } from 'react';
import {
  BookOpen,
  LifeBuoy,
  ArrowUpRight,
  Send,
  Paperclip,
  Sparkles,
  Check,
  MessageCircle,
} from 'lucide-react';
import { API, api, cash, title, type Book, type Ticket, type User } from './api';

export function Stat({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${tone}`}>{icon}</span>
      </div>
      <strong>{value}</strong>
      <div className="stat-note">
        {note}
        <span className="stat-spark">⌁</span>
      </div>
    </article>
  );
}

export function PageTitle({
  eyebrow,
  title: heading,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="page-title">
      <div className="overline">{eyebrow}</div>
      <h1>{heading}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

export function BookList({ books }: { books: Book[] }) {
  return (
    <div className="book-list">
      {books.map((book) => (
        <article className="book-row" key={book.id}>
          <div className="book-art">
            <BookOpen size={18} />
          </div>
          <div className="book-main">
            <b>{book.title}</b>
            <span>
              {book.genre} · ISBN {book.isbn} · Published{' '}
              {book.publicationDate
                ? new Date(book.publicationDate).toLocaleDateString('en-IN')
                : 'In production'}
            </span>
          </div>
          <span
            className={`status-chip ${book.status.toLowerCase().includes('production') ? 'production' : 'live'}`}
          >
            {book.status}
          </span>
          <div className="book-metric">
            <small>MRP</small>
            <b>{book.mrp ? cash(book.mrp) : '—'}</b>
          </div>
          <div className="book-metric">
            <small>Copies sold</small>
            <b>{book.totalCopiesSold.toLocaleString('en-IN')}</b>
          </div>
          <div className="book-metric">
            <small>Earned</small>
            <b>{cash(book.totalRoyaltyEarned)}</b>
          </div>
          <div className="book-metric">
            <small>Paid</small>
            <b>{cash(book.royaltyPaid)}</b>
          </div>
          <div className="book-metric">
            <small>Pending</small>
            <b>{cash(book.royaltyPending)}</b>
          </div>
        </article>
      ))}
    </div>
  );
}

export function AuthorOverview({
  books,
  tickets,
  openTicket,
  setView,
  setCompose,
}: {
  books: Book[];
  tickets: Ticket[];
  openTicket: (ticket: Ticket) => void;
  setView: (view: string) => void;
  setCompose: (open: boolean) => void;
}) {
  return (
    <>
      <div className="overview-grid">
        <section className="panel momentum">
          <div className="panel-head">
            <div>
              <div className="overline">YOUR STORIES, OUT THERE</div>
              <h2>Your bookshelf</h2>
            </div>
            <button className="inline-link" onClick={() => setView('My books')}>
              All books <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="book-shelf">
            {books.slice(0, 4).map((book, i) => (
              <button className="mini-book" key={book.id} onClick={() => setView('My books')}>
                <div className={`book-cover cover-${i % 4}`}>
                  <span>{book.genre.split(/[ /]/)[0].toUpperCase()}</span>
                  <b>{book.title}</b>
                  <small>BOOKLEAF</small>
                </div>
                <strong>{book.title}</strong>
                <small>{book.status}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="panel ticket-spotlight">
          <div className="panel-head">
            <div>
              <div className="overline">WE’RE HERE FOR YOU</div>
              <h2>Recent conversations</h2>
            </div>
            <button className="inline-link" onClick={() => setView('My tickets')}>
              All tickets <ArrowUpRight size={14} />
            </button>
          </div>
          {tickets.length ? (
            <div className="spotlight-list">
              {tickets.slice(0, 3).map((ticket) => (
                <button
                  className="spotlight-row"
                  key={ticket.id}
                  onClick={() => openTicket(ticket)}
                >
                  <span className="spot-icon">
                    <MessageCircle size={15} />
                  </span>
                  <span>
                    <b>{ticket.subject}</b>
                    <small>
                      {title(ticket.status)} · {new Date(ticket.createdAt).toLocaleDateString('en-IN')}
                    </small>
                  </span>
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          ) : (
            <div className="quiet-empty">
              <MessageCircle />
              <b>No conversations yet</b>
              <p>Start here whenever you need a hand.</p>
              <button className="text-button" onClick={() => setCompose(true)}>
                Ask the support team <ArrowUpRight size={14} />
              </button>
            </div>
          )}
        </section>
      </div>

      <section className="royalty-note">
        <div className="note-mark">✳</div>
        <div>
          <span className="overline">A NOTE FROM YOUR BOOKLEAF TEAM</span>
          <h3>Good stories deserve good support.</h3>
          <p>Ask a question about your book, royalties or next steps. Our team is here to help.</p>
        </div>
        <button onClick={() => setCompose(true)}>
          Talk to support <ArrowUpRight size={14} />
        </button>
        <div className="note-orb" />
      </section>
    </>
  );
}

export function AdminOverview({
  tickets,
  openTicket,
}: {
  tickets: Ticket[];
  openTicket: (ticket: Ticket) => void;
}) {
  const urgent = tickets
    .filter(
      (ticket) =>
        ['HIGH', 'CRITICAL'].includes(ticket.priority) &&
        ['OPEN', 'IN_PROGRESS'].includes(ticket.status),
    )
    .slice(0, 4);

  return (
    <div className="overview-grid admin-grid">
      <section className="panel queue-panel">
        <div className="panel-head">
          <div>
            <div className="overline">NEEDS A HUMAN TOUCH</div>
            <h2>Priority conversations</h2>
          </div>
          <span className="live-pill">
            <i /> Live queue
          </span>
        </div>
        {urgent.length ? (
          <TicketList items={urgent} admin onOpen={openTicket} />
        ) : (
          <div className="quiet-empty">
            <Check />
            <b>All caught up</b>
            <p>No urgent unresolved conversations right now.</p>
          </div>
        )}
      </section>

      <section className="panel response-guide">
        <div className="overline">A GOOD REPLY DOES THREE THINGS</div>
        <h2>
          Lead with care.
          <br />
          Follow with clarity.
        </h2>
        <div className="guide-step">
          <span>01</span>
          <p>
            <b>Recognise the concern</b>
            <small>Show the author you understand the impact.</small>
          </p>
        </div>
        <div className="guide-step">
          <span>02</span>
          <p>
            <b>Give a real timeline</b>
            <small>Say when the team will follow up.</small>
          </p>
        </div>
        <div className="guide-step">
          <span>03</span>
          <p>
            <b>Make the next move clear</b>
            <small>Tell them what you need or what happens next.</small>
          </p>
        </div>
      </section>
    </div>
  );
}

export function TicketList({
  items,
  admin,
  onOpen,
}: {
  items: Ticket[];
  admin: boolean;
  onOpen: (ticket: Ticket) => void;
}) {
  if (!items.length) {
    return (
      <div className="empty-panel">
        <LifeBuoy size={28} />
        <b>No tickets match this view</b>
        <p>Try changing the filters or search term.</p>
      </div>
    );
  }

  return (
    <div className="ticket-list">
      {items.map((ticket) => (
        <button className="ticket-row" onClick={() => onOpen(ticket)} key={ticket.id}>
          <span className={`priority-dot ${ticket.priority.toLowerCase()}`} />
          <div className="ticket-main">
            <b>{ticket.subject}</b>
            <span>
              {admin ? `${ticket.author.name} · ` : ''}
              {ticket.book?.title || 'General / Account level'} · {title(ticket.category)}
            </span>
          </div>
          <span className={`priority-label ${ticket.priority.toLowerCase()}`}>
            {title(ticket.priority)}
          </span>
          <span className={`status-chip status-${ticket.status.toLowerCase()}`}>
            {title(ticket.status)}
          </span>
          <time>
            {new Date(ticket.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
            })}
          </time>
          <ArrowUpRight size={15} />
        </button>
      ))}
    </div>
  );
}

export function NewTicket({
  books,
  token,
  onClose,
  onCreated,
}: {
  books: Book[];
  token: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [bookId, setBook] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  return (
    <div className="overlay" onMouseDown={onClose}>
      <form
        className="compose-modal"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr('');
          try {
            await api('/api/tickets', token, {
              method: 'POST',
              body: JSON.stringify({ bookId: bookId || null, subject, description }),
            });
            onCreated();
          } catch (error) {
            setErr((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-x" onClick={onClose}>
          ×
        </button>
        <span className="overline">LET’S GET THIS SORTED</span>
        <h2>Start a conversation</h2>
        <p>Tell us what’s on your mind. A real person from our team will take a look.</p>

        <label>
          Which book is this about?
          <select value={bookId} onChange={(e) => setBook(e.target.value)}>
            <option value="">General / Account level</option>
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </select>
        </label>

        <label>
          Subject
          <input
            required
            minLength={4}
            maxLength={160}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="A short summary of your question"
          />
        </label>

        <label>
          Tell us a little more
          <textarea
            required
            minLength={10}
            maxLength={8000}
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Share the details that will help us understand…"
          />
        </label>

        <label className="attach">
          <Paperclip size={15} />
          <span>
            {files.length
              ? files.map((file) => file.name).join(', ')
              : 'Attach photos or documents (optional)'}
          </span>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
        </label>

        {err && <div className="error-inline">{err}</div>}

        <div className="form-footer">
          <small>Attachments are noted here; file storage is not enabled in this demo.</small>
          <button className="primary-btn" disabled={busy}>
            {busy ? (
              'Sending…'
            ) : (
              <>
                Send query <ArrowUpRight size={14} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export function TicketModal({
  ticket,
  user,
  token,
  onClose,
  onRefresh,
  toast,
}: {
  ticket: Ticket;
  user: User;
  token: string;
  onClose: () => void;
  onRefresh: () => void;
  toast: (message: string) => void;
}) {
  const admin = user.role === 'ADMIN';
  const [reply, setReply] = useState('');
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await api(`/api/tickets/${ticket.id}/messages`, token, {
        method: 'POST',
        body: JSON.stringify({ body: reply }),
      });
      setReply('');
      onRefresh();
      toast('Your response has been sent.');
    } catch (error) {
      toast((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const draftAI = async () => {
    setBusy(true);
    try {
      const result = await api(`/api/tickets/${ticket.id}/draft`, token, {
        method: 'POST',
        body: '{}',
      });
      setDraft(result.draft);
      setReply(result.draft);
      toast(
        result.source === 'openai'
          ? 'AI draft is ready to edit.'
          : 'Policy-based draft is ready to edit.',
      );
    } catch (error) {
      toast((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const update = async (payload: object) => {
    try {
      await api(`/api/tickets/${ticket.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      onRefresh();
    } catch (error) {
      toast((error as Error).message);
    }
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <section className="ticket-modal" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <span className="overline">
              {ticket.id.slice(-8).toUpperCase()} · {ticket.author.name}
            </span>
            <h2>{ticket.subject}</h2>
            <p>
              {ticket.book?.title || 'General / Account level'} · Opened{' '}
              {new Date(ticket.createdAt).toLocaleString('en-IN')}
            </p>
          </div>
          <button className="modal-x" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="ticket-controls">
          <span className={`priority-label ${ticket.priority.toLowerCase()}`}>
            {title(ticket.priority)} priority
          </span>
          {admin ? (
            <>
              <select value={ticket.status} onChange={(e) => update({ status: e.target.value })}>
                {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((status) => (
                  <option key={status} value={status}>
                    {title(status)}
                  </option>
                ))}
              </select>
              <select
                value={ticket.category}
                onChange={(e) => update({ category: e.target.value })}
              >
                {['ROYALTY', 'ISBN_ISSUES', 'PRINTING', 'DISTRIBUTION', 'PRODUCTION', 'GENERAL'].map(
                  (category) => (
                    <option key={category} value={category}>
                      {title(category)}
                    </option>
                  ),
                )}
              </select>
              <select
                value={ticket.priority}
                onChange={(e) => update({ priority: e.target.value })}
              >
                {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((priority) => (
                  <option key={priority} value={priority}>
                    {title(priority)}
                  </option>
                ))}
              </select>
              <button className="small-btn" onClick={() => update({ assignToMe: true })}>
                Assign to me
              </button>
            </>
          ) : (
            <span className={`status-chip status-${ticket.status.toLowerCase()}`}>
              {title(ticket.status)}
            </span>
          )}
        </div>

        <div className="conversation">
          <article className="message author-message">
            <div className="message-meta">
              <b>{ticket.author.name}</b>
              <time>{new Date(ticket.createdAt).toLocaleString('en-IN')}</time>
            </div>
            <p>{ticket.description}</p>
          </article>
          {ticket.messages.slice(1).map((message) => (
            <article
              className={`message ${message.senderRole === 'ADMIN' ? 'staff-message' : 'author-message'}`}
              key={message.id}
            >
              <div className="message-meta">
                <b>{message.senderRole === 'ADMIN' ? 'BookLeaf Support' : ticket.author.name}</b>
                <time>{new Date(message.createdAt).toLocaleString('en-IN')}</time>
              </div>
              <p>{message.body}</p>
            </article>
          ))}
        </div>

        {admin && (
          <div className="ai-tools">
            <div>
              <Sparkles size={15} />
              <span>
                <b>Response assist</b>
                <small>
                  {draft
                    ? 'Draft ready · edit before sending'
                    : 'Policy-aware draft · always review before sending'}
                </small>
              </span>
            </div>
            <button className="small-btn" onClick={draftAI} disabled={busy}>
              {busy ? 'Working…' : 'Generate draft'}
            </button>
          </div>
        )}

        <div className="reply-box">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={
              admin ? 'Write a thoughtful response…' : 'Write a reply to the BookLeaf team…'
            }
            rows={4}
          />
          <div className="reply-actions">
            <span>Be specific, kind and clear about the next step.</span>
            <button className="primary-btn" onClick={send} disabled={busy || !reply.trim()}>
              {busy ? (
                'Sending…'
              ) : (
                <>
                  Send reply <Send size={14} />
                </>
              )}
            </button>
          </div>
        </div>

        {admin && (
          <details className="internal-notes">
            <summary>
              Internal notes <span>Private to BookLeaf</span>
            </summary>
            <div className="notes-list">
              {ticket.notes?.map((item) => (
                <p key={item.id}>
                  {item.body}
                  <small>{new Date(item.createdAt).toLocaleString('en-IN')}</small>
                </p>
              ))}
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!note.trim()) return;
                try {
                  await api(`/api/tickets/${ticket.id}/notes`, token, {
                    method: 'POST',
                    body: JSON.stringify({ body: note }),
                  });
                  setNote('');
                  onRefresh();
                } catch (error) {
                  toast((error as Error).message);
                }
              }}
            >
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a private note…"
              />
              <button>Add note</button>
            </form>
          </details>
        )}
      </section>
    </div>
  );
}

export function Login({ onLogin }: { onLogin: (token: string, user: User) => void }) {
  const [email, setEmail] = useState('priya.sharma@email.com');
  const [password, setPassword] = useState('bookleaf-demo');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="login-screen">
      <div className="login-art">
        <div className="brand brand-light">
          <div className="brand-icon">
            <BookOpen size={19} />
          </div>
          <span>
            bookleaf<span className="brand-period">.</span>
          </span>
        </div>
        <div className="art-copy">
          <span className="overline">FOR THE STORIES ONLY YOU CAN TELL</span>
          <h1>
            Your books.
            <br />
            Your people.
            <br />
            <em>One little home.</em>
          </h1>
          <p>
            A thoughtful space for your publishing journey, your royalties and the conversations
            that matter.
          </p>
        </div>
        <div className="floating-book">
          <BookOpen size={27} />
          <span>
            Stories grow
            <br />
            better together.
          </span>
        </div>
        <div className="login-orb orb-a" />
        <div className="login-orb orb-b" />
        <span className="login-foot">BOOKLEAF AUTHOR STUDIO · INDIA</span>
      </div>

      <form
        className="login-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr('');
          try {
            const response = await fetch(`${API}/api/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            });
            const data = await response.json();
            if (!response.ok) throw Error(data.error?.message || 'Could not sign in');
            onLogin(data.token, data.user);
          } catch (error) {
            setErr((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="login-form-inner">
          <div className="overline">WELCOME BACK</div>
          <h2>A good day to make progress.</h2>
          <p>Sign in to your BookLeaf workspace.</p>

          <label>
            Email address
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {err && <div className="error-inline">{err}</div>}

          <button className="primary-btn login-submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in to your studio'} <ArrowUpRight size={15} />
          </button>

          <div className="demo-access">
            <div>
              <Sparkles size={15} />
              <b>Explore the demo</b>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmail('priya.sharma@email.com');
                setPassword('bookleaf-demo');
              }}
            >
              Author view <ArrowUpRight size={13} />
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('admin@bookleaf.test');
                setPassword('bookleaf-demo');
              }}
            >
              Admin workspace <ArrowUpRight size={13} />
            </button>
            <small>
              Sample accounts use <code>bookleaf-demo</code>
            </small>
          </div>

          <div className="login-legal">
            By signing in, you agree to our <u>Terms</u> and <u>Privacy policy</u>.
          </div>
        </div>
      </form>
    </div>
  );
}
