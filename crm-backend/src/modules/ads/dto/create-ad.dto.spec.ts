import { ReorderAdsDto } from './reorder-ads.dto';

describe('ReorderAdsDto', () => {
  it('carries an ordered id list', () => {
    const dto = new ReorderAdsDto();
    dto.ids = [9, 3, 5];
    expect(dto.ids).toEqual([9, 3, 5]);
  });
});
