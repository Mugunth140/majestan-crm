import { cleanText, photoUrl, projectHighlights, rupees } from './listing-data';

describe('listing-data', () => {
  it('drops phone numbers, emails and the notes left by the old-CRM import', () => {
    const text = `Suitable for studios
Call owner on 98765 43210
Contact 9876543210 or ravi@example.com for keys
Legacy CS032 (excel row 738).
Site: Puliyakulam main road, Coords: 11.0, 76.9.
Photos pending backfill from old CRM.
<p>Near the <b>bus stand</b></p>`;
    expect(cleanText(text)).toEqual([
      'Suitable for studios',
      'Contact or for keys',
      'Near the bus stand',
    ]);
  });

  it('formats rupees the Indian way', () => {
    expect(rupees(12500000)).toBe('₹1.25 Cr');
    expect(rupees('4500000.00')).toBe('₹45 L');
    expect(rupees(30000)).toBe('₹30,000');
    expect(rupees(null)).toBeNull();
    expect(rupees('')).toBeNull();
  });

  it('reads project highlights as headed blocks', () => {
    expect(
      projectHighlights(
        'Structure\nRCC frame\nFly ash bricks\n\nGated community',
      ),
    ).toEqual([
      { heading: 'Structure', points: ['RCC frame', 'Fly ash bricks'] },
      { heading: '', points: ['Gated community'] },
    ]);
  });

  it('makes stored photo keys public URLs and skips files only on the site server', () => {
    expect(photoUrl('uploads/a.jpg')).toMatch(
      /^https:\/\/.+\/uploads\/a\.jpg$/,
    );
    expect(photoUrl('https://x.test/b.png')).toBe('https://x.test/b.png');
    expect(photoUrl('local/c.jpg')).toBeNull();
  });
});
