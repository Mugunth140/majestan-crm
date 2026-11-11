import {
  matchCriteria,
  projectMatchQuery,
  propertyMatchQuery,
  similarCriteria,
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
      bhk: [2],
    });
  });

  it('ranks units by the nearest of several wanted BHKs, without unsigned overflow', () => {
    const c = matchCriteria(
      { property_type: 'apartment', preferences: { bhk: ['2', '3', '', 'x', '3'] } },
      'Coimbatore',
    );
    expect(c.bhk).toEqual([2, 3]);
    const project = projectMatchQuery(c)!;
    expect(project.sql).toContain(
      'MIN(LEAST(ABS(CAST(u.bedrooms AS SIGNED) - ?), ABS(CAST(u.bedrooms AS SIGNED) - ?)))',
    );
    expect(project.params.slice(-2)).toEqual([2, 3]);
    expect(project.params).toHaveLength(placeholders(project.sql));
    const property = propertyMatchQuery(c);
    expect(property.sql).toContain('LEAST(ABS(CAST(pd.bedrooms AS SIGNED) - ?)');
    expect(property.params).toHaveLength(placeholders(property.sql));
    expect(matchCriteria({ preferences: { bhk: [] } }, null).bhk).toEqual([]);
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

  it('keeps an industrial requirement to industrial listings', () => {
    const warehouse = matchCriteria(
      { property_category: 'industrial', property_type: 'warehouse' },
      null,
    );
    expect(warehouse.types).toEqual(['industrial']);
    expect(similarCriteria(warehouse).criteria.types).toEqual(['industrial']);
    const bare = matchCriteria({ property_category: 'industrial' }, null);
    expect(bare.types).toEqual(['industrial']);
    expect(bare.broadTypes).toEqual(['industrial']);
    expect(projectMatchQuery(bare)).toBeNull();
  });

  it('keeps a commercial warehouse to commercial listings', () => {
    const c = matchCriteria(
      { property_category: 'commercial', property_type: 'warehouse' },
      null,
    );
    expect(c.types).toEqual(['commercial']);
    expect(c.broadTypes).toEqual(['commercial', 'coworking']);
  });

  it('still reads a type without a category', () => {
    const c = matchCriteria({ property_type: 'warehouse' }, null);
    expect(c.types).toEqual(['commercial', 'industrial']);
  });

  it('widens to the whole category and drops budget and area for similar listings', () => {
    const c = matchCriteria(
      {
        property_category: 'residential',
        property_type: 'apartment',
        purchase_type: 'rental',
        preferences: { minBudget: 15000, maxBudget: 25000, minArea: 900 },
      },
      'Coimbatore',
    );
    const { criteria, target } = similarCriteria(c);
    expect(criteria.types).toEqual(
      expect.arrayContaining(['apartment', 'villa', 'plot']),
    );
    expect(criteria).toMatchObject({
      listing: 'Rent',
      city: 'Coimbatore',
      minBudget: null,
      maxBudget: null,
      minArea: null,
    });
    expect(target).toBe(20000);

    const q = propertyMatchQuery(criteria, { target, exclude: [4, 9] });
    expect(q.sql).toContain('p.id NOT IN (?, ?)');
    expect(q.sql).toContain('ABS(p.price - ?), 1e15)');
    expect(q.params).toHaveLength((q.sql.match(/\?/g) || []).length);
    expect(q.params.slice(-1)).toEqual([20000]);

    const project = projectMatchQuery(criteria, { target, exclude: [5] })!;
    expect(project.params).toHaveLength(
      (project.sql.match(/\?/g) || []).length,
    );
  });
});
