import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { S3Client } from 'bun';
import { Asset } from '../../database/entities/asset.entity';
import { AssetLocation } from '../../database/entities/asset-location.entity';
import { AssetFinancials } from '../../database/entities/asset-financials.entity';
import { AssetFeature } from '../../database/entities/asset-feature.entity';
import { AssetDocument } from '../../database/entities/asset-document.entity';
import { CreateAssetDto } from './dto/create-asset.dto';

@Injectable()
export class AssetsService {
  private _s3Client: S3Client | null = null;

  constructor(private dataSource: DataSource) {}

  private get s3Client(): S3Client {
    if (!this._s3Client) {
      this._s3Client = new S3Client({
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        bucket: process.env.R2_BUCKET_NAME || '',
        region: 'auto',
      });
    }
    return this._s3Client;
  }

  async create(dto: CreateAssetDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const asset = queryRunner.manager.create(Asset, { 
        owner_name: dto.owner_name, 
        mobile_number: dto.mobile_number 
      });
      const savedAsset = await queryRunner.manager.save(asset);

      if (dto.location) {
        await queryRunner.manager.save(queryRunner.manager.create(AssetLocation, { ...dto.location, asset_id: savedAsset.id }));
      }
      if (dto.financials) {
        await queryRunner.manager.save(queryRunner.manager.create(AssetFinancials, { ...dto.financials, asset_id: savedAsset.id }));
      }
      if (dto.features) {
        await queryRunner.manager.save(queryRunner.manager.create(AssetFeature, { ...dto.features, asset_id: savedAsset.id }));
      }

      await queryRunner.commitTransaction();
      return savedAsset;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll() {
    return this.dataSource.getRepository(Asset).find({
      order: { created_at: 'DESC' }
    });
  }

  async findOne(id: number) {
    const asset = await this.dataSource.getRepository(Asset).findOne({
      where: { id },
      relations: { assigned_staff: true }
    });
    if (!asset) throw new NotFoundException('Asset not found');

    const location = await this.dataSource.getRepository(AssetLocation).findOne({ where: { asset_id: id } });
    const financials = await this.dataSource.getRepository(AssetFinancials).findOne({ where: { asset_id: id } });
    const features = await this.dataSource.getRepository(AssetFeature).findOne({ where: { asset_id: id } });
    const documents = await this.dataSource.getRepository(AssetDocument).find({ where: { asset_id: id } });

    return { ...asset, location, financials, features, documents };
  }

  async uploadMedia(assetId: number, files: { document?: Express.Multer.File[], images?: Express.Multer.File[] }) {
    const asset = await this.dataSource.getRepository(Asset).findOne({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Asset not found');

    const repo = this.dataSource.getRepository(AssetDocument);
    const uploadedDocs = [];

    // Process Document (Max 1)
    if (files.document && files.document.length > 0) {
      const docFile = files.document[0];
      const ext = docFile.originalname.split('.').pop();
      const fileName = docFile.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileKey = `asset-inventory/${assetId}/doc_${Date.now()}_${fileName}`;
      
      await this.s3Client.write(fileKey, docFile.buffer, { type: docFile.mimetype });
      const fileUrl = `${process.env.R2_PUBLIC_URL}/${fileKey}`;
      
      const saved = await repo.save(repo.create({
        asset_id: assetId,
        file_name: fileName,
        file_url: fileUrl,
        file_key: fileKey,
        file_type: 'document'
      }));
      uploadedDocs.push(saved);
    }

    // Process Images (Max 4)
    if (files.images && files.images.length > 0) {
      const imagesToProcess = files.images.slice(0, 4); // enforce max 4 just in case
      for (const imgFile of imagesToProcess) {
        const fileName = imgFile.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileKey = `asset-inventory/${assetId}/img_${Date.now()}_${fileName}`;
        
        await this.s3Client.write(fileKey, imgFile.buffer, { type: imgFile.mimetype });
        const fileUrl = `${process.env.R2_PUBLIC_URL}/${fileKey}`;
        
        const saved = await repo.save(repo.create({
          asset_id: assetId,
          file_name: fileName,
          file_url: fileUrl,
          file_key: fileKey,
          file_type: 'image'
        }));
        uploadedDocs.push(saved);
      }
    }

    return uploadedDocs;
  }
}
