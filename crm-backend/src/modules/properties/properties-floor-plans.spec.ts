import { ValidationPipe } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { PermissionsService } from '../permissions/permissions.service';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';
import type { SiteApiService } from './site-api.service';

type PlanDocument = {
  fileKey: string;
  fileName: string;
  title: string;
  documentType: string;
};

describe('Named property floor plans through CRM updates', () => {
  it('forwards every floor name with its file and reloads the names independently of filenames', async () => {
    let stored: PlanDocument[] = [];
    const siteApi = {
      get: jest.fn(async (path: string) =>
        path === '/properties/form-data'
          ? { cities: [] }
          : {
              id: 7,
              propertyType: 'apartment',
              status: 'available',
              propertyFiles: stored.map((document, index) => ({
                id: index + 1,
                title: document.title,
                documentType: document.documentType,
                file: {
                  fileKey: document.fileKey,
                  fileName: document.fileName,
                },
              })),
            },
      ),
      patch: jest.fn(
        async (_path: string, body: { documents?: PlanDocument[] }) => {
          stored = body.documents ?? stored;
          return { id: 7 };
        },
      ),
    };
    const service = new PropertiesService(
      siteApi as unknown as SiteApiService,
      {} as PermissionsService,
      {} as DataSource,
    );
    const documents: PlanDocument[] = [
      {
        fileKey: 'plans/one.png',
        fileName: 'drawing-01.png',
        title: 'Ground floor',
        documentType: 'floor_plan',
      },
      {
        fileKey: 'plans/two.pdf',
        fileName: 'drawing-02.pdf',
        title: 'First floor',
        documentType: 'floor_plan',
      },
    ];
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const update = (await pipe.transform(
      { documents },
      { type: 'body', metatype: UpdatePropertyDto },
    )) as UpdatePropertyDto;
    await service.update(7, update);
    expect(siteApi.patch).toHaveBeenCalledWith(
      '/admin/properties/apartment/7',
      expect.objectContaining({
        documents: documents.map((document) => ({
          ...document,
          title: document.title,
          isPublic: true,
        })),
      }),
    );
    const reloaded = await service.findOne(7);
    expect(reloaded.documents).toMatchObject(documents);
  });
});
