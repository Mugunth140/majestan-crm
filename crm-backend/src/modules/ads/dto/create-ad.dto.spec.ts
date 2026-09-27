import { ValidationPipe } from '@nestjs/common';
import { CreateAdDto } from './create-ad.dto';

describe('CreateAdDto whitelist', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });

  it('keeps the full advertisement payload from the Advertisement form', async () => {
    const payload = {
      placement: 'hero',
      title: 'Diwali Offer',
      desktopImageKey: 'uploads/temp/d.png',
      mobileImageKey: 'uploads/temp/m.png',
      linkType: 'preset',
      linkPreset: 'buy-apartments',
      sortOrder: 0,
      isActive: true,
    };

    const result = (await pipe.transform(payload, {
      type: 'body',
      metatype: CreateAdDto,
    })) as any;

    expect(result.title).toBe('Diwali Offer');
    expect(result.desktopImageKey).toBe('uploads/temp/d.png');
    expect(result.mobileImageKey).toBe('uploads/temp/m.png');
    expect(result.linkPreset).toBe('buy-apartments');
  });
});
