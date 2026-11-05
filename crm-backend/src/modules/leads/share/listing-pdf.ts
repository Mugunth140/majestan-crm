import PDFDocument from 'pdfkit';
import { join } from 'path';
import type { Listing } from './listing-data';

// A one-listing brochure for customers, branded Majestan Realty: logo header,
// cover photo, price and key facts, write-up, amenities, units (projects),
// a photo gallery, and the logo mark watermarked across every page.

const ASSETS = join(__dirname, 'assets');
const NAVY = '#2a3f7f';
const INK = '#1c2230';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';
const SOFT = '#f4f6fa';

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 42;
const WIDTH = PAGE.width - MARGIN * 2;
const TOP = 92;
const BOTTOM = PAGE.height - 64;

export interface Advisor {
  name: string;
  phone: string | null;
  email: string | null;
}

export function renderListingPdf(
  listing: Listing,
  photos: Buffer[],
  advisor: Advisor | null,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    bufferPages: true,
    info: {
      Title: `${listing.title} – Majestan Realty`,
      Author: 'Majestan Realty',
      Subject: listing.code,
    },
  });
  doc.registerFont('regular', join(ASSETS, 'NotoSans-Regular.ttf'));
  doc.registerFont('medium', join(ASSETS, 'NotoSans-Medium.ttf'));
  doc.registerFont('bold', join(ASSETS, 'NotoSans-Bold.ttf'));

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  let y = TOP;
  const newPage = () => {
    doc.addPage({ size: 'A4', margin: 0 });
    y = TOP;
  };
  /** Starts a new page when the next block won't fit. */
  const room = (height: number) => {
    if (y + height > BOTTOM) newPage();
  };
  const text = (
    value: string,
    font: string,
    size: number,
    color: string,
    options: PDFKit.Mixins.TextOptions = {},
  ) => {
    doc.font(font).fontSize(size).fillColor(color);
    const height = doc.heightOfString(value, { width: WIDTH, ...options });
    room(height);
    doc.text(value, MARGIN, y, { width: WIDTH, ...options });
    y += height;
  };
  const heading = (title: string) => {
    // Keep a heading with at least the start of what it introduces.
    room(100);
    y += 22;
    doc.rect(MARGIN, y + 3, 3, 12).fill(NAVY);
    doc
      .font('bold')
      .fontSize(12.5)
      .fillColor(INK)
      .text(title, MARGIN + 10, y, { width: WIDTH - 10 });
    y += 26;
  };
  const photo = (
    buffer: Buffer,
    x: number,
    top: number,
    w: number,
    h: number,
  ) => {
    doc.save();
    doc.roundedRect(x, top, w, h, 8).clip();
    try {
      doc.image(buffer, x, top, {
        cover: [w, h],
        align: 'center',
        valign: 'center',
      });
    } catch {
      doc.rect(x, top, w, h).fill(SOFT);
    }
    doc.restore();
  };

  // ── Cover ─────────────────────────────────────────────────────────────
  const [cover, ...gallery] = photos;
  if (cover) {
    photo(cover, MARGIN, y, WIDTH, 270);
  } else {
    doc.roundedRect(MARGIN, y, WIDTH, 170, 8).fill(SOFT);
    doc.image(join(ASSETS, 'fav.png'), PAGE.width / 2 - 30, y + 55, {
      width: 60,
    });
  }
  y += (cover ? 270 : 170) + 20;

  doc
    .font('medium')
    .fontSize(8.5)
    .fillColor(NAVY)
    .text(
      `${listing.kind === 'project' ? 'PROJECT' : 'PROPERTY'} · ${listing.code}`,
      MARGIN,
      y,
      { characterSpacing: 0.8 },
    );
  y += 16;
  text(listing.title, 'bold', 21, INK);
  y += 2;
  if (listing.subtitle) text(listing.subtitle, 'regular', 10.5, MUTED);
  y += 14;

  // Price band
  const bandTop = y;
  doc.roundedRect(MARGIN, bandTop, WIDTH, 54, 8).fill(SOFT);
  doc
    .font('bold')
    .fontSize(18)
    .fillColor(NAVY)
    .text(listing.price, MARGIN + 16, bandTop + 10, { width: WIDTH * 0.62 });
  if (listing.priceNote)
    doc
      .font('regular')
      .fontSize(9.5)
      .fillColor(MUTED)
      .text(listing.priceNote, MARGIN + 16, bandTop + 34, {
        width: WIDTH * 0.62,
      });
  if (listing.url) {
    const label = 'View on majestanrealty.com  ›';
    doc
      .font('medium')
      .fontSize(9.5)
      .fillColor(NAVY)
      .text(label, MARGIN, bandTop + 20, { width: WIDTH - 16, align: 'right' });
    const w = doc.widthOfString(label);
    doc.link(MARGIN + WIDTH - 16 - w, bandTop + 18, w, 16, listing.url);
  }
  y = bandTop + 54;

  // ── Key facts: three per row ─────────────────────────────────────────
  if (listing.facts.length) {
    heading(listing.kind === 'project' ? 'Project overview' : 'Key details');
    const col = WIDTH / 3;
    for (let i = 0; i < listing.facts.length; i += 3) {
      const row = listing.facts.slice(i, i + 3);
      doc.font('medium').fontSize(10.5);
      const height =
        Math.max(
          ...row.map(([, value]) =>
            doc.heightOfString(value, { width: col - 14 }),
          ),
        ) + 22;
      room(height);
      row.forEach(([label, value], j) => {
        const x = MARGIN + j * col;
        doc
          .font('regular')
          .fontSize(8)
          .fillColor(MUTED)
          .text(label.toUpperCase(), x, y, {
            width: col - 14,
            characterSpacing: 0.5,
          });
        doc
          .font('medium')
          .fontSize(10.5)
          .fillColor(INK)
          .text(value, x, y + 13, { width: col - 14 });
      });
      y += height;
      doc
        .moveTo(MARGIN, y - 6)
        .lineTo(MARGIN + WIDTH, y - 6)
        .lineWidth(0.5)
        .strokeColor(LINE)
        .stroke();
      y += 4;
    }
  }

  // ── Write-up ─────────────────────────────────────────────────────────
  if (listing.description.length) {
    heading('About this ' + listing.kind);
    for (const paragraph of listing.description) {
      text(paragraph, 'regular', 10, INK, { lineGap: 2.5 });
      y += 6;
    }
  }

  if (listing.units.length) {
    heading('Available units');
    const cols = [WIDTH * 0.42, WIDTH * 0.28, WIDTH * 0.3];
    const row = (
      cells: string[],
      font: string,
      color: string,
      fill?: string,
    ) => {
      room(24);
      if (fill) doc.rect(MARGIN, y, WIDTH, 22).fill(fill);
      let x = MARGIN + 10;
      cells.forEach((cell, i) => {
        doc
          .font(font)
          .fontSize(9.5)
          .fillColor(color)
          .text(cell, x, y + 6, {
            width: cols[i] - 14,
            align: i === 2 ? 'right' : 'left',
            lineBreak: false,
          });
        x += cols[i];
      });
      y += 22;
    };
    row(['Unit', 'Size', 'Price'], 'medium', MUTED, SOFT);
    for (const unit of listing.units) {
      row([unit.type, unit.size, unit.price], 'regular', INK);
      doc
        .moveTo(MARGIN, y)
        .lineTo(MARGIN + WIDTH, y)
        .lineWidth(0.5)
        .strokeColor(LINE)
        .stroke();
    }
  }

  if (listing.amenities.length) {
    heading('Amenities');
    const col = WIDTH / 3;
    for (let i = 0; i < listing.amenities.length; i += 3) {
      room(20);
      listing.amenities.slice(i, i + 3).forEach((name, j) => {
        const x = MARGIN + j * col;
        doc.circle(x + 3, y + 7, 2).fill(NAVY);
        doc
          .font('regular')
          .fontSize(10)
          .fillColor(INK)
          .text(name, x + 11, y, {
            width: col - 16,
            lineBreak: false,
            ellipsis: true,
          });
      });
      y += 19;
    }
  }

  for (const block of listing.highlights) {
    heading(block.heading || 'Highlights');
    for (const point of block.points) {
      doc.font('regular').fontSize(10);
      const height =
        doc.heightOfString(point, { width: WIDTH - 14, lineGap: 2 }) + 5;
      room(height);
      doc.circle(MARGIN + 3, y + 7, 2).fill(NAVY);
      doc
        .fillColor(INK)
        .text(point, MARGIN + 14, y, { width: WIDTH - 14, lineGap: 2 });
      y += height;
    }
  }

  // ── Gallery: two per row ─────────────────────────────────────────────
  if (gallery.length) {
    heading('Photos');
    const gap = 12;
    const w = (WIDTH - gap) / 2;
    const h = w * 0.66;
    for (let i = 0; i < gallery.length; i += 2) {
      room(h + gap);
      gallery
        .slice(i, i + 2)
        .forEach((buffer, j) => photo(buffer, MARGIN + j * (w + gap), y, w, h));
      y += h + gap;
    }
  }

  if (advisor) {
    room(90);
    y += 18;
    doc
      .roundedRect(MARGIN, y, WIDTH, 62, 8)
      .lineWidth(0.8)
      .strokeColor(LINE)
      .stroke();
    doc
      .font('regular')
      .fontSize(8)
      .fillColor(MUTED)
      .text('YOUR MAJESTAN ADVISOR', MARGIN + 16, y + 12, {
        characterSpacing: 0.5,
      });
    doc
      .font('bold')
      .fontSize(12)
      .fillColor(INK)
      .text(advisor.name, MARGIN + 16, y + 25);
    const reach = [advisor.phone, advisor.email]
      .filter(Boolean)
      .join('   ·   ');
    if (reach)
      doc
        .font('regular')
        .fontSize(9.5)
        .fillColor(MUTED)
        .text(reach, MARGIN + 16, y + 42, { width: WIDTH - 32 });
    y += 62;
  }

  // ── Every page: header, footer, watermark ─────────────────────────────
  const range = doc.bufferedPageRange();
  const today = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.image(join(ASSETS, 'logo.png'), MARGIN, 34, { width: 150 });
    doc
      .font('regular')
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(today, MARGIN, 44, { width: WIDTH, align: 'right' });
    doc
      .moveTo(MARGIN, 72)
      .lineTo(MARGIN + WIDTH, 72)
      .lineWidth(0.6)
      .strokeColor(LINE)
      .stroke();

    doc.save();
    doc.opacity(0.06);
    doc.image(
      join(ASSETS, 'fav.png'),
      PAGE.width / 2 - 150,
      PAGE.height / 2 - 147,
      { width: 300 },
    );
    doc.restore();

    const footer = PAGE.height - 40;
    doc
      .moveTo(MARGIN, footer - 10)
      .lineTo(MARGIN + WIDTH, footer - 10)
      .lineWidth(0.6)
      .strokeColor(LINE)
      .stroke();
    doc
      .font('medium')
      .fontSize(8)
      .fillColor(NAVY)
      .text('Majestan Realty', MARGIN, footer, { lineBreak: false });
    const brand = doc.widthOfString('Majestan Realty');
    doc
      .font('regular')
      .fillColor(MUTED)
      .text('·  www.majestanrealty.com', MARGIN + brand + 6, footer, {
        lineBreak: false,
      });
    doc.link(
      MARGIN,
      footer - 2,
      brand + 6 + doc.widthOfString('·  www.majestanrealty.com'),
      12,
      'https://www.majestanrealty.com',
    );
    doc
      .font('regular')
      .fontSize(8)
      .fillColor(MUTED)
      .text(`Page ${i + 1} of ${range.count}`, MARGIN, footer, {
        width: WIDTH,
        align: 'right',
        lineBreak: false,
      });
    doc
      .fontSize(6.5)
      .text(
        'Details are indicative and subject to change. Please confirm with your advisor before deciding.',
        MARGIN,
        footer + 12,
        {
          width: WIDTH,
          lineBreak: false,
        },
      );
  }

  doc.end();
  return done;
}
