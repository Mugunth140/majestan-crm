import {
  matchCriteria,
  projectMatchQuery,
  propertyMatchQuery,
} from './auto-match';

const placeholders = (sql: string) => (sql.match(/\?/g) || []).length;

describe('auto-match', () => {
  it('reads a requirement into site terms', () => {
    const c = matchCriteria(
      {
        property_category: 'commercial',
        property_type: 'shop',
        purchase_type: 'rental',
        sub_locations: ['Irugur'],
        preferences: { minBudget: 5000, maxBudget: '', bhk: '2' },
      },
      'Coimbatore',
    );
    expect(c).toMatchObject({
      types: ['commercial', 'coworking'],
      listing: 'Rent',
      city: 'Coimbatore',
      localities: ['Irugur'],
      minBudget: 5000,
      maxBudget: null,
      bhk: 2,
    });
  });

  it('searches everything when the requirement says nothing', () => {
    const c = matchCriteria(
      { purchase_type: 'construction', preferences: null },
      null,
    );
    expect(c).toMatchObject({ types: null, listing: null, localities: [] });
    expect(propertyMatchQuery(c).params).toEqual([]);
    expect(projectMatchQuery(c)).not.toBeNull();
  });

  it('skips projects for types the site has no projects of', () => {
    expect(
      projectMatchQuery(
        matchCriteria({ property_category: 'industrial' }, null),
      ),
    ).toBeNull();
  });

  it('gives every placeholder a value, in order', () => {
    const c = matchCriteria(
      {
        property_type: 'apartment',
        purchase_type: 'buy',
        sub_locations: ['RS Puram', 'Peelamedu'],
        preferences: {
          minBudget: 1,
          maxBudget: 2,
          bhk: 3,
          minArea: 4,
          maxArea: 5,
        },
      },
      'Coimbatore',
    );
    const property = propertyMatchQuery(c);
    expect(property.params).toHaveLength(placeholders(property.sql));
    expect(property.params.slice(0, 2)).toEqual(['RS Puram', 'Peelamedu']);
    expect(property.params.slice(-3)).toEqual(['RS Puram', 'Peelamedu', 3]);
    const project = projectMatchQuery(c)!;
    expect(project.params).toHaveLength(placeholders(project.sql));
    expect(project.params).toEqual([
      'RS Puram',
      'Peelamedu',
      'sale',
      0.8,
      2.4,
      'apartment',
      'Coimbatore',
      'RS Puram',
      'Peelamedu',
      3,
    ]);
  });
});
