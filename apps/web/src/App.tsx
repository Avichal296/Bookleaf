import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  BookOpen,
  LayoutDashboard,
  LifeBuoy,
  Wallet,
  Search,
  Bell,
  Plus,
  ArrowUpRight,
  Clock3,
  Users,
  ChevronDown,
  Sparkles,
  Check,
  SlidersHorizontal,
  LogOut,
  Inbox,
  FileText,
  Menu,
} from 'lucide-react';
import { API, api, cash, title, type Book, type Ticket, type User } from './api';
import {
  AdminOverview,
  AuthorOverview,
  BookList,
  Login,
  NewTicket,
  PageTitle,
  Stat,
  TicketList,
  TicketModal,
} from './screens';

const knowledgeBase = [
  [
    'Royalties & payments',
    '80/20 of net profit after printing, platform commission and shipping. Calculated quarterly; paid within 45 days of quarter end. ₹1,000 minimum, with smaller balances carried forward.',
  ],
  [
    'ISBN & metadata',
    'Each BookLeaf title receives a unique ISBN under the BookLeaf imprint. ISBN mismatches are high priority and escalated to production within 48 hours.',
  ],
  [
    'Printing & quality',
    'Standard print turnaround is 5–7 business days. Verified defects qualify for a free reprint; request photos to help confirm the issue.',
  ],
  [
    'Distribution',
    'New listings typically appear 7–10 business days after publication. Stock sync issues can be re-synced within 24–48 hours.',
  ],
  [
    'Production stages',
    'Manuscript → editing → cover design → typesetting → proofreading → ISBN → printing → distribution → published.',
  ],
  [
    'Tone & next steps',
    'Acknowledge the concern, own mistakes, give specific timelines and finish with a clear action for the author or BookLeaf team.',
  ],
];

export function App() {
  const [token, setToken] = useState(localStorage.getItem('bookleaf-token') || '');
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState('Overview');
  const [books, setBooks] = useState<Book[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<any>({});
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [notice, setNotice] = useState('');
  const [compose, setCompose] = useState(false);
  const [filters, setFilters] = useState({ category: '', priority: '', date: '' });
  const [mobile, setMobile] = useState(false);

  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3200);
  };

  const load = async (q = query) => {
    if (!token) return;
    try {
      const [nextBooks, dashboard, ticketPage] = await Promise.all([
        api('/api/books', token),
        api('/api/dashboard', token),
        api(
          `/api/tickets?q=${encodeURIComponent(q)}&status=${status}&category=${filters.category}&priority=${filters.priority}&since=${filters.date}`,
          token,
        ),
      ]);
      setBooks(nextBooks);
      setStats(dashboard);
      setTickets(ticketPage.items);
    } catch (error) {
      toast((error as Error).message);
    }
  };

  useEffect(() => {
    if (token) {
      api('/api/auth/me', token)
        .then((session: User) => setUser(session))
        .catch(() => {
          localStorage.removeItem('bookleaf-token');
          setToken('');
        });
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      load('');
      const socket: Socket = io(API, { auth: { token } });
      socket.on('ticket:created', () => load());
      socket.on('ticket:updated', () => load());
      socket.on('ticket:message', () => load());
      return () => {
        socket.disconnect();
      };
    }
  }, [user?.id, token]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => load(query), 280);
    return () => window.clearTimeout(timer);
  }, [query, status, filters.category, filters.priority]);

  const openTicket = async (ticket: Ticket) => {
    try {
      const fresh = await api(`/api/tickets/${ticket.id}`, token);
      setSelected(fresh);
      const socket = io(API, { auth: { token } });
      socket.emit('ticket:join', ticket.id);
      socket.on('ticket:message', () => api(`/api/tickets/${ticket.id}`, token).then(setSelected));
      socket.on('ticket:updated', () => api(`/api/tickets/${ticket.id}`, token).then(setSelected));
      (window as any).__ticketSocket?.disconnect();
      (window as any).__ticketSocket = socket;
    } catch (error) {
      toast((error as Error).message);
    }
  };

  const logout = () => {
    localStorage.removeItem('bookleaf-token');
    setToken('');
    setUser(null);
    setSelected(null);
  };

  if (!user) {
    return (
      <Login
        onLogin={(nextToken, nextUser) => {
          localStorage.setItem('bookleaf-token', nextToken);
          setToken(nextToken);
          setUser(nextUser);
        }}
      />
    );
  }

  const admin = user.role === 'ADMIN';
  const nav = admin
    ? ([
        ['Overview', LayoutDashboard],
        ['Ticket queue', Inbox],
        ['Authors', Users],
        ['Knowledge base', FileText],
      ] as const)
    : ([
        ['Overview', LayoutDashboard],
        ['My books', BookOpen],
        ['My tickets', LifeBuoy],
        ['Royalty & payments', Wallet],
      ] as const);

  const pending = admin
    ? (stats.statusCounts || [])
        .filter((item: any) => ['OPEN', 'IN_PROGRESS'].includes(item.status))
        .reduce((total: number, item: any) => total + item._count._all, 0)
    : 0;

  const AccountIcon = admin ? Users : LifeBuoy;
  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}>
        <div className="brand">
          <div className="brand-icon">
            <BookOpen size={19} />
          </div>
          <span>
            bookleaf<span className="brand-period">.</span>
          </span>
          <button className="mobile-menu" onClick={() => setMobile(false)}>
            ×
          </button>
        </div>

        <div className="workspace">
          <div className="workspace-logo">{admin ? 'BL' : initials}</div>
          <div>
            <b>{admin ? 'Support desk' : user.name}</b>
            <small>{admin ? 'Operations team' : 'Author account'}</small>
          </div>
          <ChevronDown size={15} />
        </div>

        <div className="nav-heading">{admin ? 'OPERATIONS' : 'YOUR STUDIO'}</div>
        <nav>
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              onClick={() => {
                setView(label);
                setMobile(false);
              }}
              className={`nav-link ${view === label ? 'selected' : ''}`}
            >
              <Icon size={17} />
              {label}
              {label === 'Ticket queue' && <span className="badge-count">{pending}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-fill" />

        <div className="help-card">
          <div className="help-glyph">
            <Sparkles size={16} />
          </div>
          <b>{admin ? 'Every reply builds trust.' : 'Your next chapter starts here.'}</b>
          <p>
            {admin
              ? 'A thoughtful response can turn a concern into confidence.'
              : 'Guides and practical tips for wherever your writing takes you.'}
          </p>
          <button onClick={() => setView(admin ? 'Knowledge base' : 'My books')}>
            {admin ? 'Open playbook' : 'Explore resources'} <ArrowUpRight size={13} />
          </button>
        </div>

        <div className="account">
          <div className="avatar">{initials}</div>
          <div>
            <b>{user.name}</b>
            <small>{admin ? 'Support admin' : 'Author account'}</small>
          </div>
          <button className="icon-quiet" onClick={logout} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="mobile-toggle" onClick={() => setMobile(true)}>
            <Menu />
          </button>
          <div className="breadcrumbs">
            {admin ? 'Support desk' : 'Author studio'} <span>/</span> <b>{view}</b>
          </div>
          <div className="top-right">
            <label className="search-box">
              <Search size={15} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={admin ? 'Search tickets, authors…' : 'Search your books and tickets'}
              />
              <kbd>⌘ K</kbd>
            </label>
            <button className="top-icon" onClick={() => toast('You’re all caught up')}>
              <Bell size={17} />
              <i />
            </button>
            <div className="top-avatar">{initials}</div>
          </div>
        </header>

        <div className="page">
          {view === 'Overview' && (
            <>
              <div className="welcome">
                <div>
                  <div className="overline">
                    <i /> {admin ? 'BOOKLEAF OPERATIONS' : 'YOUR AUTHOR DASHBOARD'}{' '}
                    <span>· WEDNESDAY, 28 OCTOBER</span>
                  </div>
                  <h1>
                    {admin ? 'Good morning, team' : 'Good morning, ' + user.name.split(' ')[0]}
                    <span className="sun">✳</span>
                  </h1>
                  <p>
                    {admin
                      ? 'A clear view of every conversation waiting for your team.'
                      : 'Your stories are finding their readers. Here’s how things are moving.'}
                  </p>
                </div>
                {!admin && (
                  <button className="primary-btn" onClick={() => setCompose(true)}>
                    <Plus size={16} /> New support query
                  </button>
                )}
              </div>

              <div className="stat-grid">
                <Stat
                  icon={<Wallet />}
                  label="Royalties earned"
                  value={cash(stats.earned)}
                  note="Across your published books"
                  tone="mint"
                />
                <Stat
                  icon={<BookOpen />}
                  label="Copies sold"
                  value={Number(stats.copiesSold || 0).toLocaleString('en-IN')}
                  note={`${stats.books || 0} titles in your catalogue`}
                  tone="peach"
                />
                <Stat
                  icon={<Clock3 />}
                  label={admin ? 'Open conversations' : 'Royalty pending'}
                  value={admin ? String(pending) : cash(stats.pending)}
                  note={admin ? 'Across all author accounts' : 'Next payout follows quarterly cycle'}
                  tone="lavender"
                />
                <Stat
                  icon={<AccountIcon />}
                  label={admin ? 'Authors supported' : 'My support tickets'}
                  value={String(admin ? stats.authors || 10 : stats.tickets || 0)}
                  note={admin ? 'Publishing partners' : 'We’re here when you need us'}
                  tone="sage"
                />
              </div>

              {admin ? (
                <AdminOverview tickets={tickets} openTicket={openTicket} />
              ) : (
                <AuthorOverview
                  books={books}
                  tickets={tickets}
                  openTicket={openTicket}
                  setView={setView}
                  setCompose={setCompose}
                />
              )}
            </>
          )}

          {view === 'My books' && (
            <>
              <PageTitle
                eyebrow="YOUR CATALOGUE"
                title="Books in your world"
                subtitle="Publication details, sales and royalty figures, all in one place."
              />
              <BookList books={books} />
            </>
          )}

          {view === 'Royalty & payments' && (
            <>
              <PageTitle
                eyebrow="CLEAR AND TRANSPARENT"
                title="Royalty overview"
                subtitle="Your earnings, payments and pending balance at a glance."
              />
              <div className="royalty-hero">
                <div>
                  <div className="eyebrow-light">TOTAL ROYALTY EARNED</div>
                  <strong>{cash(stats.earned)}</strong>
                  <span>From {Number(stats.copiesSold || 0).toLocaleString('en-IN')} copies sold</span>
                </div>
                <div className="royalty-split">
                  <div>
                    <span>Paid to date</span>
                    <b>{cash(stats.paid)}</b>
                  </div>
                  <div>
                    <span>Pending balance</span>
                    <b>{cash(stats.pending)}</b>
                  </div>
                  <div>
                    <span>Payout cycle</span>
                    <b>Quarterly · within 45 days</b>
                  </div>
                </div>
              </div>
              <BookList books={books} />
            </>
          )}

          {(view === 'My tickets' || view === 'Ticket queue') && (
            <>
              <div className="list-title">
                <PageTitle
                  eyebrow={admin ? 'AUTHOR CARE · INBOX' : 'YOUR CONVERSATIONS'}
                  title={admin ? 'Support queue' : 'My support tickets'}
                  subtitle={
                    admin
                      ? 'Prioritised by urgency and age, so the most important issue gets seen first.'
                      : 'Track every question and reply from the BookLeaf team.'
                  }
                />
                {!admin && (
                  <button className="primary-btn" onClick={() => setCompose(true)}>
                    <Plus size={16} /> New query
                  </button>
                )}
              </div>

              <div className="filters">
                <label className="filter-select">
                  <SlidersHorizontal size={15} />
                  <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="">All statuses</option>
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </label>
                {admin && (
                  <>
                    <select
                      value={filters.category}
                      onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                    >
                      <option value="">All categories</option>
                      {['ROYALTY', 'ISBN_ISSUES', 'PRINTING', 'DISTRIBUTION', 'PRODUCTION', 'GENERAL'].map(
                        (category) => (
                          <option value={category} key={category}>
                            {title(category)}
                          </option>
                        ),
                      )}
                    </select>
                    <select
                      value={filters.priority}
                      onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                    >
                      <option value="">All priorities</option>
                      {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((priority) => (
                        <option value={priority} key={priority}>
                          {title(priority)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filters.date}
                      onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                    >
                      <option value="">Any date</option>
                      <option value={new Date(Date.now() - 7 * 86400000).toISOString()}>
                        Last 7 days
                      </option>
                      <option value={new Date(Date.now() - 30 * 86400000).toISOString()}>
                        Last 30 days
                      </option>
                    </select>
                  </>
                )}
                <span>
                  {tickets.length} conversation{tickets.length === 1 ? '' : 's'}
                </span>
              </div>
              <TicketList items={tickets} admin={admin} onOpen={openTicket} />
            </>
          )}

          {view === 'Authors' && (
            <>
              <PageTitle
                eyebrow="AUTHOR DIRECTORY"
                title="Publishing partners"
                subtitle="Authors in the BookLeaf community."
              />
              <div className="empty-panel">
                <Users size={28} />
                <b>Author directory</b>
                <p>Author profiles are available from their support conversations.</p>
                <button className="text-button" onClick={() => setView('Ticket queue')}>
                  Go to ticket queue <ArrowUpRight size={14} />
                </button>
              </div>
            </>
          )}

          {view === 'Knowledge base' && (
            <>
              <PageTitle
                eyebrow="RESPONSE PLAYBOOK"
                title="BookLeaf knowledge base"
                subtitle="The policy context used to draft consistent, author-first responses."
              />
              <div className="kb-grid">
                {knowledgeBase.map(([heading, body]) => (
                  <article className="kb-card" key={heading}>
                    <span>
                      <FileText size={16} />
                    </span>
                    <h3>{heading}</h3>
                    <p>{body}</p>
                  </article>
                ))}
              </div>
            </>
          )}

          <footer className="footer">
            <span>© 2026 BookLeaf Publishing</span>
            <span>
              Made for the stories only you can tell <i>♥</i>
            </span>
            <span>Privacy · Terms</span>
          </footer>
        </div>
      </main>

      {selected && (
        <TicketModal
          ticket={selected}
          user={user}
          token={token}
          onClose={() => {
            setSelected(null);
            (window as any).__ticketSocket?.disconnect();
          }}
          onRefresh={() => api(`/api/tickets/${selected.id}`, token).then(setSelected)}
          toast={toast}
        />
      )}

      {compose && (
        <NewTicket
          books={books}
          token={token}
          onClose={() => setCompose(false)}
          onCreated={() => {
            setCompose(false);
            load();
            setView('My tickets');
            toast('Your query is with our support team.');
          }}
        />
      )}

      {notice && (
        <div className="toast">
          <Check size={15} />
          {notice}
        </div>
      )}
    </div>
  );
}
