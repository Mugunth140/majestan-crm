import {
  cleanText,
  photoUrl,
  projectListing,
  propertyListing,
  rupees,
} from './listing-data';

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

  it('lays a project out as sections, without the write-up', () => {
    const listing = projectListing(
      {
        id: 6,
        project_code: 'PA0006',
        name: 'Emerald Heights',
        project_type: 'apartment',
        towers: 2,
        total_floors: 10,
        project_area_sqft: 43560,
        description: 'Long write-up',
        address: 'Kgisl Campus, call 98765 43210',
        city: 'Coimbatore',
        latitude: 11.08,
        longitude: 76.99,
        tower_details: '[{"tower":"Alpha","units":8,"floors":10}]',
        connectivity: [{ label: 'Airport', detail: 'Just 15 km' }],
        nearby_categories: [
          { title: 'Education', places: [{ name: 'KCT', distance: '1.1 km' }] },
        ],
        gallery_image_urls: '["uploads/a.jpg"]',
      },
      [
        {
          bedrooms: 2,
          bathrooms: 2,
          balconies: 1,
          carpet_area_sqft: 1000,
          builtup_area_sqft: 1200,
          facing: 'north',
          listing_mode: 'sale',
          price: 9500000,
          floor_plans: '[{"imageUrl":"uploads/plan.jpg"}]',
        },
        {
          bedrooms: 3,
          carpet_area_sqft: 1400,
          listing_mode: 'sale',
          price: 12000000,
        },
      ],
      [
        { name: 'CCTV', category: 'security' },
        { name: 'SHOP', category: 'other' },
        { name: 'Wifi', category: 'other' },
      ],
    );
    expect(listing.sections.map((s) => s.title)).toEqual([
      'Overview',
      'Sizes',
      'Towers',
      'Location',
      'Amenities',
      'Units & configuration',
    ]);
    const get = (title: string) =>
      listing.sections.find((s) => s.title === title)!;
    expect(get('Sizes').facts).toEqual([
      ['Project area', '43,560 sq ft (1.00 acres)'],
      ['Configurations', '2, 3 BHK'],
      ['Unit sizes', '1,000 sq ft – 1,400 sq ft'],
    ]);
    expect(get('Towers').table!.rows).toEqual([['Alpha', '10', '8']]);
    expect(get('Location').facts).toContainEqual([
      'Address',
      'Kgisl Campus, call',
    ]);
    expect(get('Location').groups).toEqual([
      { title: 'Connectivity', items: ['Airport – Just 15 km'] },
      { title: 'Education', items: ['KCT · 1.1 km'] },
    ]);
    expect(get('Location').link!.url).toContain('11.08,76.99');
    expect(get('Amenities').items).toEqual(['CCTV', 'Wifi']);
    expect(get('Units & configuration').table!.rows[0]).toEqual([
      '2 BHK',
      '2 Beds · 2 Baths · 1 Balcony',
      'Carpet 1,000 sq ft\nBuilt-up 1,200 sq ft',
      'North',
      '₹95 L',
    ]);
    expect(listing.price).toBe('₹95 L – ₹1.2 Cr');
    expect(JSON.stringify(listing)).not.toContain('Long write-up');
    expect(listing.photos.map((p) => p.split('/').pop())).toEqual([
      'a.jpg',
      'plan.jpg',
    ]);
  });

  it('leaves out empty sections', () => {
    const listing = propertyListing(
      {
        id: 1,
        title: 'Shop',
        property_type: 'shop',
        listing_type: 'Rent',
        price: 30000,
        city: 'Coimbatore',
      },
      [],
      [],
    );
    expect(listing.sections.map((s) => s.title)).toEqual([
      'Overview',
      'Location',
    ]);
    expect(listing.price).toBe('₹30,000 / month');
  });

  it('makes stored photo keys public URLs and skips files only on the site server', () => {
    expect(photoUrl('uploads/a.jpg')).toMatch(
      /^https:\/\/.+\/uploads\/a\.jpg$/,
    );
    expect(photoUrl('https://x.test/b.png')).toBe('https://x.test/b.png');
    expect(photoUrl('local/c.jpg')).toBeNull();
  });
});
