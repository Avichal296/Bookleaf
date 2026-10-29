export const API = import.meta.env.VITE_API_URL || '';

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'AUTHOR' | 'ADMIN';
};

export type Book = {
  id: string;
  title: string;
  isbn: string;
  genre: string;
  publicationDate: string | null;
  status: string;
  mrp: string | null;
  totalCopiesSold: number;
  totalRoyaltyEarned: string;
  royaltyPaid: string;
  royaltyPending: string;
  channels: string[];
};

export type Message = {
  id: string;
  senderId: string;
  senderRole: string;
  body: string;
  createdAt: string;
};

export type Ticket = {
  id: string;
  subject: string;
  description: string;
  status: string;
  category: string;
  priority: string;
  createdAt: string;
  author: { id: string; name: string; email: string };
  book: { id: string; title: string } | null;
  messages: Message[];
  notes?: { id: string; body: string; createdAt: string }[];
};

export function cash(value: string | number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function title(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function api(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Something went wrong');
  return data;
}
