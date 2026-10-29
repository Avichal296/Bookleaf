import type { Priority, TicketCategory } from '@prisma/client';

export const categories: TicketCategory[] = [
  'ROYALTY',
  'ISBN_ISSUES',
  'PRINTING',
  'DISTRIBUTION',
  'PRODUCTION',
  'GENERAL',
];

export function classifyLocal(text: string): { category: TicketCategory; priority: Priority } {
  const t = text.toLowerCase();
  let category: TicketCategory = 'GENERAL';

  if (/royalt|payment|payout|paid|earning|bank|money|₹/.test(t)) {
    category = 'ROYALTY';
  } else if (/isbn|metadata|imprint|duplicate/.test(t)) {
    category = 'ISBN_ISSUES';
  } else if (/print|binding|misprint|blurry|quality|defect|copy/.test(t)) {
    category = 'PRINTING';
  } else if (/amazon|flipkart|distribution|available|listing|storefront|stock/.test(t)) {
    category = 'DISTRIBUTION';
  } else if (/status|production|typeset|proof|editing|cover|manuscript|stage/.test(t)) {
    category = 'PRODUCTION';
  }

  const high =
    /urgent|critical|6 months|overdue|wrong isbn|duplicate isbn|defect|terrible|not received|no royalty|unavailable|delayed/.test(t);
  const medium = /when|issue|problem|error|missing|incorrect/.test(t);
  const priority: Priority = high ? 'HIGH' : medium ? 'MEDIUM' : 'LOW';

  return { category, priority };
}

export async function classifyAI(subject: string, description: string) {
  const fallback = classifyLocal(`${subject} ${description}`);
  const key = process.env.OPENAI_API_KEY;
  if (!key) return fallback;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 80,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Classify BookLeaf author support tickets. Return JSON with category one of ROYALTY, ISBN_ISSUES, PRINTING, DISTRIBUTION, PRODUCTION, GENERAL and priority one of CRITICAL, HIGH, MEDIUM, LOW. High priority for overdue/missing royalties, ISBN errors, severe print defects, or unavailable books. Critical only for severe time-sensitive cases.',
          },
          {
            role: 'user',
            content: `Subject: ${subject}\nDescription: ${description}`,
          },
        ],
      }),
    });

    clearTimeout(timeout);
    if (!resp.ok) throw Error('AI unavailable');

    const data = (await resp.json()) as any;
    const result = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
    const priorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

    return {
      category: categories.includes(result.category) ? result.category : fallback.category,
      priority: priorities.includes(result.priority) ? (result.priority as Priority) : fallback.priority,
    };
  } catch {
    return fallback;
  }
}

export async function draftWithAI(subject: string, description: string, category: string) {
  const fallback = `Hi, thank you for reaching out, and I’m sorry this has been frustrating. I’ve noted your ${category.toLowerCase().replaceAll('_', ' ')} concern and our team will review the details. BookLeaf calculates royalties quarterly and pays within 45 days after quarter end; ISBN errors are escalated to production; verified print defects qualify for a free reprint; and distribution syncs can take 24–48 hours. We’ll follow up with a specific update within 48 hours. Please reply with any screenshots or details that can help us investigate.\n\nWarmly,\nBookLeaf Author Support`;

  const key = process.env.OPENAI_API_KEY;
  if (!key) return { draft: fallback, source: 'fallback' };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 300,
        messages: [
          {
            role: 'system',
            content:
              'You are a BookLeaf Publishing support representative. Be empathetic, specific, professional, own BookLeaf errors, state a timeline and next step. Do not invent account facts. Policy: 80/20 split of net profit after printing/platform commission/shipping; quarterly calculations, paid within 45 days after quarter, ₹1,000 minimum threshold. ISBN issues escalate to production within 48 hours. Verified print defects receive free reprints, 5–7 business days. New distribution listings take 7–10 business days; stock resync takes 24–48 hours. Metadata changes reflect in 3–5 business days. Use the smallest relevant policy context. If information is missing, ask for it.',
          },
          {
            role: 'user',
            content: `Category: ${category}\nSubject: ${subject}\nQuery: ${description}`,
          },
        ],
      }),
    });

    clearTimeout(timeout);
    if (!resp.ok) throw new Error(`LLM ${resp.status}`);

    const data = (await resp.json()) as any;
    const content = data.choices?.[0]?.message?.content?.trim();
    return content ? { draft: content, source: 'openai' } : { draft: fallback, source: 'fallback' };
  } catch {
    return { draft: fallback, source: 'fallback' };
  }
}
