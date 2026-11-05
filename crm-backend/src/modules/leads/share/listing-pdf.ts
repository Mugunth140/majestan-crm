import PDFDocument from 'pdfkit';
import { join } from 'path';
import type { Listing } from './listing-data';

// A one-listing brochure for customers, branded Majestan Realty: logo header,
// title and price, then one section per topic (overview, sizes, towers,
// location, amenities, units), small photos, and the logo mark watermarked
// across every page.

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

export function renderListingPdf(
  listing: Listing,
  photos: Buffer[],
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
    doc.roundedRect(x, top, w, h, 5).clip();
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

  // ── Title and price ──────────────────────────────────────────────────
  y += 4;
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

  // ── Building blocks for the sections ─────────────────────────────────
  const rule = (at: number) =>
    doc
      .moveTo(MARGIN, at)
      .lineTo(MARGIN + WIDTH, at)
      .lineWidth(0.5)
      .strokeColor(LINE)
      .stroke();

  /** Label over value, three per row. */
  const factGrid = (pairs: [string, string][]) => {
    const col = WIDTH / 3;
    for (let i = 0; i < pairs.length; i += 3) {
      const row = pairs.slice(i, i + 3);
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
      rule(y - 6);
      y += 4;
    }
  };

  /** A table whose cells may wrap; the last column is right-aligned. */
  const table = (columns: string[], widths: number[], rows: string[][]) => {
    const cols = widths.map((w) => w * WIDTH);
    const pad = 8;
    const cell = (value: string, i: number) => ({
      width: cols[i] - pad * 2,
      align: (i === cols.length - 1 && i > 0 ? 'right' : 'left') as
        | 'right'
        | 'left',
      lineGap: 1.5,
    });
    const draw = (
      cells: string[],
      font: string,
      size: number,
      color: string,
      fill?: string,
    ) => {
      doc.font(font).fontSize(size);
      const height =
        Math.max(...cells.map((c, i) => doc.heightOfString(c, cell(c, i)))) +
        14;
      room(height);
      if (fill) doc.rect(MARGIN, y, WIDTH, height).fill(fill);
      let x = MARGIN;
      cells.forEach((c, i) => {
        doc
          .font(i === 0 && !fill ? 'medium' : font)
          .fontSize(size)
          .fillColor(color)
          .text(c, x + pad, y + 7, cell(c, i));
        x += cols[i];
      });
      y += height;
      return height;
    };
    const head = () => draw(columns, 'medium', 8.5, MUTED, SOFT);
    room(60);
    head();
    for (const cells of rows) {
      doc.font('regular').fontSize(9.5);
      const need =
        Math.max(...cells.map((c, i) => doc.heightOfString(c, cell(c, i)))) +
        14;
      // Repeat the header when a table carries on to the next page.
      if (y + need > BOTTOM) {
        newPage();
        head();
      }
      draw(cells, 'regular', 9.5, INK);
      rule(y);
    }
    y += 10;
  };

  /** Small titled lists side by side, two per row. */
  const groupGrid = (groups: { title: string; items: string[] }[]) => {
    const gap = 18;
    const col = (WIDTH - gap) / 2;
    const heightOf = (g: { items: string[] }) => {
      doc.font('regular').fontSize(9);
      return (
        16 +
        g.items.reduce(
          (sum, item) =>
            sum + doc.heightOfString(item, { width: col - 12 }) + 3,
          0,
        )
      );
    };
    for (let i = 0; i < groups.length; i += 2) {
      const row = groups.slice(i, i + 2);
      const height = Math.max(...row.map(heightOf)) + 10;
      room(height);
      row.forEach((g, j) => {
        const x = MARGIN + j * (col + gap);
        let at = y;
        doc
          .font('medium')
          .fontSize(9.5)
          .fillColor(NAVY)
          .text(g.title, x, at, { width: col });
        at += 16;
        for (const item of g.items) {
          doc.circle(x + 2.5, at + 5.5, 1.6).fill(MUTED);
          doc.font('regular').fontSize(9).fillColor(INK);
          doc.text(item, x + 10, at, { width: col - 12 });
          at += doc.heightOfString(item, { width: col - 12 }) + 3;
        }
      });
      y += height;
    }
  };

  /** Short items with a dot, three per row. */
  const itemGrid = (items: string[]) => {
    const col = WIDTH / 3;
    for (let i = 0; i < items.length; i += 3) {
      room(20);
      items.slice(i, i + 3).forEach((name, j) => {
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
  };

  // ── Sections ─────────────────────────────────────────────────────────
  for (const section of listing.sections) {
    heading(section.title);
    if (section.facts?.length) factGrid(section.facts);
    if (section.table?.rows.length) {
      if (section.facts?.length) y += 6;
      table(section.table.columns, section.table.widths, section.table.rows);
    }
    if (section.groups?.length) {
      if (section.facts?.length) y += 8;
      groupGrid(section.groups);
    }
    if (section.items?.length) itemGrid(section.items);
    if (section.link) {
      room(20);
      y += 4;
      const label = `${section.link.label}  ›`;
      doc.font('medium').fontSize(9.5).fillColor(NAVY).text(label, MARGIN, y);
      doc.link(MARGIN, y - 2, doc.widthOfString(label), 15, section.link.url);
      y += 16;
    }
  }

  // ── Photos: small, four per row ──────────────────────────────────────
  if (photos.length) {
    heading('Photos');
    const gap = 8;
    const w = (WIDTH - gap * 3) / 4;
    const h = w * 0.72;
    for (let i = 0; i < photos.length; i += 4) {
      room(h + gap);
      photos
        .slice(i, i + 4)
        .forEach((buffer, j) => photo(buffer, MARGIN + j * (w + gap), y, w, h));
      y += h + gap;
    }
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
        'Details are indicative and subject to change. Please confirm with Majestan Realty before deciding.',
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
