import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import {
  PrismaClient,
  Prisma,
  type Role,
  type TicketCategory,
  type Priority,
  type TicketStatus,
} from '@prisma/client';
import Redis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { compare } from 'bcryptjs';
import { classifyAI, classifyLocal, draftWithAI } from './classify';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});
const supportQueue = new Queue('support-events', { connection: redis });

const app = express();
const server = createServer(app);
const clientOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isAllowedClientOrigin = (origin: string | undefined) =>
  !origin ||
  clientOrigins.includes(origin) ||
  /^https:\/\/bookleaf-dnqg-[a-z0-9-]+\.vercel\.app$/.test(origin);

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (isAllowedClientOrigin(origin)) callback(null, true);
    else callback(new Error('Origin not allowed by CORS'));
  },
};

const io = new Server(server, { cors: corsOptions });
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

const tokenSecret = process.env.JWT_SECRET ?? 'local-only-change-this-secret';

interface Session {
  id: string;
  role: Role;
  name: string;
  email: string;
}

type AuthedRequest = Request & { user?: Session };

function fail(res: Response, code: number, message: string) {
  return res.status(code).json({ error: { message, status: code } });
}

function wrap(
  fn: (req: AuthedRequest, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req as AuthedRequest, res, next).catch(next);
  };
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const header = (req.headers.authorization ?? '').replace(/^Bearer\\s+/i, '');
    req.user = jwt.verify(header, tokenSecret) as Session;
    next();
  } catch {
    fail(res, 401, 'Please sign in to continue');
  }
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.role === 'ADMIN') next();
  else fail(res, 403, 'Admin access required');
}

async function cache<T>(key: string, load: () => Promise<T>, ttl = 35): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as T;
  } catch {}

  const value = await load();

  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch {}

  return value;
}

async function bust() {
  try {
    const keys = await redis.keys('dashboard:*');
    if (keys.length) await redis.del(...keys);
  } catch {}
}

function ticketInclude(isAdmin: boolean) {
  return {
    author: { select: { id: true, name: true, email: true } },
    book: { select: { id: true, title: true } },
    messages: { orderBy: { createdAt: 'asc' as const } },
    ...(isAdmin ? { notes: { orderBy: { createdAt: 'desc' as const } } } : {}),
  };
}

const createTicket = z.object({
  bookId: z.string().nullable().optional(),
  subject: z.string().min(4).max(160),
  description: z.string().min(10).max(8000),
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'bookleaf-support-api' });
});

app.post(
  '/api/auth/login',
  wrap(async (req, res) => {
    const input = z
      .object({
        email: z.string().email(),
        password: z.string().min(1),
      })
      .safeParse(req.body);

    if (!input.success) {
      return fail(res, 400, 'Enter a valid email and password');
    }

    const user = await prisma.author.findUnique({
      where: { email: input.data.email.toLowerCase() },
    });

    if (!user || !(await compare(input.data.password, user.passwordHash))) {
      return fail(res, 401, 'Email or password is incorrect');
    }

    const session = {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    };

    res.json({
      token: jwt.sign(session, tokenSecret, { expiresIn: '12h' }),
      user: session,
    });
  }),
);

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
  res.json(req.user);
});

app.get(
  '/api/books',
  requireAuth,
  wrap(async (req, res) => {
    const books = await prisma.book.findMany({
      where: req.user!.role === 'ADMIN' ? {} : { authorId: req.user!.id },
      orderBy: [{ status: 'asc' }, { title: 'asc' }],
    });
    res.json(books);
  }),
);

app.get(
  '/api/dashboard',
  requireAuth,
  wrap(async (req, res) => {
    const key = `dashboard:${req.user!.role}:${req.user!.id}`;

    res.json(
      await cache(key, async () => {
        const authorFilter = req.user!.role === 'ADMIN' ? {} : { authorId: req.user!.id };

        const [authors, books, aggregate, statusCounts, tickets] = await Promise.all([
          req.user!.role === 'ADMIN'
            ? prisma.author.count({ where: { role: 'AUTHOR' } })
            : Promise.resolve(1),
          prisma.book.count({ where: authorFilter }),
          prisma.book.aggregate({
            where: authorFilter,
            _sum: {
              totalCopiesSold: true,
              totalRoyaltyEarned: true,
              royaltyPaid: true,
              royaltyPending: true,
            },
          }),
          prisma.ticket.groupBy({
            by: ['status'],
            where: authorFilter,
            _count: { _all: true },
          }),
          prisma.ticket.count({ where: authorFilter }),
        ]);

        return {
          authors,
          books,
          copiesSold: aggregate._sum.totalCopiesSold ?? 0,
          earned: Number(aggregate._sum.totalRoyaltyEarned ?? 0),
          paid: Number(aggregate._sum.royaltyPaid ?? 0),
          pending: Number(aggregate._sum.royaltyPending ?? 0),
          tickets,
          statusCounts,
        };
      }),
    );
  }),
);

app.get(
  '/api/tickets',
  requireAuth,
  wrap(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    const status = String(req.query.status ?? '');
    const category = String(req.query.category ?? '');
    const priority = String(req.query.priority ?? '');
    const since = String(req.query.since ?? '');
    const page = Math.max(1, Number(req.query.page) || 1);
    const take = Math.min(50, Math.max(1, Number(req.query.take) || 25));

    const where: Prisma.TicketWhereInput = {
      ...(req.user!.role === 'ADMIN' ? {} : { authorId: req.user!.id }),
      ...(status ? { status: status as TicketStatus } : {}),
      ...(category ? { category: category as TicketCategory } : {}),
      ...(priority ? { priority: priority as Priority } : {}),
      ...(since ? { createdAt: { gte: new Date(since) } } : {}),
      ...(q
        ? {
            OR: [
              { subject: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
              { author: { name: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: ticketInclude(req.user!.role === 'ADMIN'),
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        skip: (page - 1) * take,
        take,
      }),
      prisma.ticket.count({ where }),
    ]);

    res.json({ items, total, page, take });
  }),
);

app.get(
  '/api/tickets/:id',
  requireAuth,
  wrap(async (req, res) => {
    const ticket = await prisma.ticket.findUnique({
      where: { id: String(req.params.id) },
      include: ticketInclude(req.user!.role === 'ADMIN'),
    });

    if (!ticket) return fail(res, 404, 'Ticket not found');
    if (req.user!.role !== 'ADMIN' && ticket.authorId !== req.user!.id) {
      return fail(res, 403, 'You can only view your own tickets');
    }

    res.json(ticket);
  }),
);

app.post(
  '/api/tickets',
  requireAuth,
  wrap(async (req, res) => {
    if (req.user!.role !== 'AUTHOR') {
      return fail(res, 403, 'Only author accounts can submit queries');
    }

    const parsed = createTicket.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          message: 'Check the subject and description fields',
          details: parsed.error.flatten(),
        },
      });
    }

    const { subject, description } = parsed.data;
    const bookId = parsed.data.bookId || null;

    if (bookId && !(await prisma.book.findFirst({ where: { id: bookId, authorId: req.user!.id } }))) {
      return fail(res, 400, 'Choose one of your own books');
    }

    const ai = classifyLocal(`${subject} ${description}`);
    const ticket = await prisma.ticket.create({
      data: {
        authorId: req.user!.id,
        bookId,
        subject,
        description,
        category: ai.category,
        aiCategory: ai.category,
        priority: ai.priority,
        aiPriority: ai.priority,
        messages: {
          create: {
            senderId: req.user!.id,
            senderRole: 'AUTHOR',
            body: description,
          },
        },
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
        book: { select: { id: true, title: true } },
        messages: true,
      },
    });

    await bust();
    io.to('admins').emit('ticket:created', { ticketId: ticket.id });
    io.to(`author:${ticket.authorId}`).emit('ticket:created', { ticketId: ticket.id });

    try {
      await supportQueue.add(
        'classify-ticket',
        { ticketId: ticket.id, subject, description },
        {
          jobId: `classify-${ticket.id}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1500 },
          removeOnComplete: 1000,
        },
      );
    } catch (queueError) {
      console.warn('Classification queue unavailable; keeping local classification', queueError);
    }

    res.status(201).json(ticket);
  }),
);

app.post(
  '/api/tickets/:id/draft',
  requireAuth,
  requireAdmin,
  wrap(async (req, res) => {
    const ticket = await prisma.ticket.findUnique({
      where: { id: String(req.params.id) },
      select: { subject: true, description: true, category: true },
    });

    if (!ticket) return fail(res, 404, 'Ticket not found');
    res.json(await draftWithAI(ticket.subject, ticket.description, ticket.category));
  }),
);

app.post(
  '/api/tickets/:id/messages',
  requireAuth,
  wrap(async (req, res) => {
    const parsed = z.object({ body: z.string().min(1).max(8000) }).safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'A response cannot be empty');

    const ticket = await prisma.ticket.findUnique({
      where: { id: String(req.params.id) },
      select: { id: true, authorId: true },
    });

    if (!ticket) return fail(res, 404, 'Ticket not found');
    if (req.user!.role !== 'ADMIN' && ticket.authorId !== req.user!.id) {
      return fail(res, 403, 'You can only reply to your own tickets');
    }

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: req.user!.id,
          senderRole: req.user!.role,
          body: parsed.data.body,
        },
      });

      await tx.ticket.update({
        where: { id: ticket.id },
        data: { status: req.user!.role === 'AUTHOR' ? 'OPEN' : undefined },
      });

      return created;
    });

    await bust();
    io.to(`ticket:${ticket.id}`).emit('ticket:message', message);
    io.to('admins').emit('ticket:updated', { ticketId: ticket.id });
    io.to(`author:${ticket.authorId}`).emit('ticket:updated', { ticketId: ticket.id });
    res.status(201).json(message);
  }),
);

app.patch(
  '/api/tickets/:id',
  requireAuth,
  requireAdmin,
  wrap(async (req, res) => {
    const parsed = z
      .object({
        status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
        category: z
          .enum(['ROYALTY', 'ISBN_ISSUES', 'PRINTING', 'DISTRIBUTION', 'PRODUCTION', 'GENERAL'])
          .optional(),
        priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
        assignToMe: z.boolean().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) return fail(res, 400, 'Invalid ticket update');

    const { assignToMe, ...fields } = parsed.data;
    const data: any = {
      ...fields,
      assignedTo: assignToMe ? req.user!.id : undefined,
      ...(fields.category ? { aiCategory: null } : {}),
      ...(fields.priority ? { aiPriority: null } : {}),
    };

    const ticket = await prisma.ticket.update({
      where: { id: String(req.params.id) },
      data,
      include: { author: { select: { id: true, name: true, email: true } } },
    });

    await bust();
    const event = { ticketId: ticket.id, status: ticket.status };
    io.to(`ticket:${ticket.id}`).emit('ticket:updated', event);
    io.to('admins').emit('ticket:updated', event);
    io.to(`author:${ticket.authorId}`).emit('ticket:updated', event);
    res.json(ticket);
  }),
);

app.post(
  '/api/tickets/:id/notes',
  requireAuth,
  requireAdmin,
  wrap(async (req, res) => {
    const parsed = z.object({ body: z.string().min(1).max(4000) }).safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'Internal note cannot be empty');

    const note = await prisma.internalNote.create({
      data: {
        ticketId: String(req.params.id),
        authorId: req.user!.id,
        body: parsed.data.body,
      },
    });

    res.status(201).json(note);
  }),
);

app.get(
  '/api/admin/overview',
  requireAuth,
  requireAdmin,
  wrap(async (_req, res) => {
    const [byStatus, byCategory, oldestOpen, byPriority] = await Promise.all([
      prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ['category'], _count: { _all: true } }),
      prisma.ticket.findMany({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        orderBy: { createdAt: 'asc' },
        take: 5,
        include: {
          author: { select: { name: true } },
          book: { select: { title: true } },
        },
      }),
      prisma.ticket.groupBy({
        by: ['priority'],
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        _count: { _all: true },
      }),
    ]);

    res.json({ byStatus, byCategory, oldestOpen, byPriority });
  }),
);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);

  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: { message: 'Invalid request', details: err.flatten() } });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      return fail(res, 404, 'Record not found');
    }
  }

  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: {
      message: isProd ? 'Something went wrong' : 'Request failed',
      ...(isProd ? {} : { detail: err instanceof Error ? err.message : 'Unexpected error' }),
    },
  });
});

io.use((socket, next) => {
  try {
    const payload = jwt.verify(String(socket.handshake.auth?.token ?? ''), tokenSecret) as Session;
    socket.data.user = payload;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  const user = socket.data.user as Session;
  socket.join(user.role === 'ADMIN' ? 'admins' : `author:${user.id}`);

  socket.on('ticket:join', async (id: string) => {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { authorId: true },
    });

    if (ticket && (user.role === 'ADMIN' || ticket.authorId === user.id)) {
      socket.join(`ticket:${id}`);
    }
  });
});

new Worker(
  'support-events',
  async (job) => {
    if (job.name !== 'classify-ticket') return job.data;

    const ai = await classifyAI(job.data.subject, job.data.description);
    const current = await prisma.ticket.findUnique({
      where: { id: job.data.ticketId },
      select: {
        authorId: true,
        category: true,
        priority: true,
        aiCategory: true,
        aiPriority: true,
      },
    });

    if (!current) return;

    const data: any = {
      aiCategory: ai.category,
      aiPriority: ai.priority,
    };

    if (current.category === current.aiCategory) data.category = ai.category;
    if (current.priority === current.aiPriority) data.priority = ai.priority;

    const updated = await prisma.ticket.update({
      where: { id: job.data.ticketId },
      data,
    });

    await bust();
    const payload = {
      ticketId: job.data.ticketId,
      category: updated.category,
      priority: updated.priority,
    };

    io.to('admins').emit('ticket:updated', payload);
    io.to(`author:${current.authorId}`).emit('ticket:updated', payload);
    return payload;
  },
  { connection: redis, concurrency: 4 },
);

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
server.listen(port, () => console.log(`BookLeaf Support API listening on ${port}`));
