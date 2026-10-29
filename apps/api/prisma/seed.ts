import { PrismaClient, Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();

async function main() {
  const dataPath = path.resolve(process.cwd(), 'prisma/data/sample.json');
  const { authors } = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as { authors: any[] };
  const passwordHash = await hash(process.env.DEMO_PASSWORD ?? 'bookleaf-demo', 10);

  for (const author of authors) {
    await prisma.author.upsert({
      where: { id: author.author_id },
      create: {
        id: author.author_id,
        name: author.name,
        email: author.email,
        phone: author.phone,
        city: author.city,
        joinedDate: new Date(author.joined_date),
        passwordHash,
      },
      update: {
        name: author.name,
        phone: author.phone,
        city: author.city,
        passwordHash,
      },
    });

    for (const book of author.books) {
      await prisma.book.upsert({
        where: { id: book.book_id },
        create: {
          id: book.book_id,
          authorId: author.author_id,
          title: book.title,
          isbn: book.isbn,
          genre: book.genre,
          publicationDate: book.publication_date ? new Date(book.publication_date) : null,
          status: book.status,
          mrp: book.mrp == null ? null : new Prisma.Decimal(book.mrp),
          royaltyPerCopy:
            book.author_royalty_per_copy == null
              ? null
              : new Prisma.Decimal(book.author_royalty_per_copy),
          totalCopiesSold: book.total_copies_sold,
          totalRoyaltyEarned: book.total_royalty_earned,
          royaltyPaid: book.royalty_paid,
          royaltyPending: book.royalty_pending,
          lastPayoutDate: book.last_royalty_payout_date
            ? new Date(book.last_royalty_payout_date)
            : null,
          printPartner: book.print_partner,
          channels: book.available_on,
        },
        update: {
          authorId: author.author_id,
          title: book.title,
          status: book.status,
          totalCopiesSold: book.total_copies_sold,
          totalRoyaltyEarned: book.total_royalty_earned,
          royaltyPaid: book.royalty_paid,
          royaltyPending: book.royalty_pending,
          channels: book.available_on,
        },
      });
    }
  }

  const adminHash = await hash(process.env.DEMO_PASSWORD ?? 'bookleaf-demo', 10);
  await prisma.author.upsert({
    where: { email: 'admin@bookleaf.test' },
    create: {
      id: 'ADMIN001',
      name: 'BookLeaf Support',
      email: 'admin@bookleaf.test',
      phone: '+91-00000-00000',
      city: 'Delhi',
      joinedDate: new Date(),
      passwordHash: adminHash,
      role: 'ADMIN',
    },
    update: {
      passwordHash: adminHash,
      role: 'ADMIN',
    },
  });

  const bookCount = authors.reduce((total, author) => total + author.books.length, 0);
  console.log(`Seeded ${authors.length} authors and ${bookCount} books`);
}

main().finally(() => prisma.$disconnect());
