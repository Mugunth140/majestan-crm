import { ValidationPipe } from '@nestjs/common';
import { ReorderAdsDto } from './reorder-ads.dto';
const pipe = new ValidationPipe({ whitelist: true, transform: true });
it('preserves reorder IDs through the CRM validation boundary', async () => {
 expect(await pipe.transform({ ids: [8, 7] }, { type: 'body', metatype: ReorderAdsDto })).toMatchObject({ ids: [8, 7] });
});
it.each([undefined, [], [7, 7], [0, 8], ['7', 8]])('rejects invalid ordering %p', async ids => {
 await expect(pipe.transform({ ids }, { type: 'body', metatype: ReorderAdsDto })).rejects.toThrow();
});
