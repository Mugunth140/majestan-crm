import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { S3Client } from 'bun';
import { Asset } from '../../database/entities/asset.entity';
import { AssetLocation } from '../../database/entities/asset-location.entity';
import { AssetFinancials } from '../../database/entities/asset-financials.entity';
import { AssetFeature } from '../../database/entities/asset-feature.entity';
import { AssetDocument } from '../../database/entities/asset-document.entity';
import { AssetLayout } from '../../database/entities/asset-layout.entity';
import { UpdateAssetDto } from './dto/update-asset.dto';
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
        mobile_number: dto.mobile_number,
        source: dto.source,
        mediator_name: dto.mediator_name,
        cp_reference_name: dto.cp_reference_name,
        remarks: dto.remarks
      });
      const savedAsset = await queryRunner.manager.save(asset);
      
      savedAsset.display_id = `AST${String(savedAsset.id).padStart(4, '0')}`;
      await queryRunner.manager.save(savedAsset);

      if (dto.location) {
        await queryRunner.manager.save(queryRunner.manager.create(AssetLocation, { ...dto.location, asset_id: savedAsset.id }));
      }
      if (dto.financials) {
        await queryRunner.manager.save(queryRunner.manager.create(AssetFinancials, { ...dto.financials, asset_id: savedAsset.id }));
      }
      if (dto.features) {
        await queryRunner.manager.save(queryRunner.manager.create(AssetFeature, { ...dto.features, asset_id: savedAsset.id }));
      }

      if (dto.layouts && Array.isArray(dto.layouts)) {
        for (const layoutDto of dto.layouts) {
          await queryRunner.manager.save(queryRunner.manager.create(AssetLayout, { ...layoutDto, asset_id: savedAsset.id }));
        }
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

  async findAll(user?: any) {
    const whereClause: any = {};
    if (user && user.role === 'Staff') {
      whereClause.assigned_staff_id = user.id;
    } else if (user && user.role === 'Team Lead') {
      whereClause.assigned_staff = { department_id: user.department_id };
    }

    return this.dataSource.getRepository(Asset).find({
      where: whereClause,
      order: { created_at: 'DESC' },
      relations: { location: true, financials: true, feature: true }
    });
  }

  async findOne(id: number, user?: any) {
    const asset = await this.dataSource.getRepository(Asset).findOne({
      where: { id },
      relations: { assigned_staff: true }
    });
    if (!asset) throw new NotFoundException('Asset not found');

    if (user && user.role === 'Staff' && asset.assigned_staff_id !== user.id) {
      throw new NotFoundException('Asset not found');
    }

    const location = await this.dataSource.getRepository(AssetLocation).findOne({ where: { asset_id: id } });
    const financials = await this.dataSource.getRepository(AssetFinancials).findOne({ where: { asset_id: id } });
    const features = await this.dataSource.getRepository(AssetFeature).findOne({ where: { asset_id: id } });
    const documents = await this.dataSource.getRepository(AssetDocument).find({ where: { asset_id: id } });
    const layouts = await this.dataSource.getRepository(AssetLayout).find({ where: { asset_id: id } });

    return { ...asset, location, financials, features, documents, layouts };
  }

  
  async update(id: number, dto: UpdateAssetDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const assetRepo = queryRunner.manager.getRepository(Asset);
      const asset = await assetRepo.findOne({ where: { id } });
      if (!asset) throw new NotFoundException('Asset not found');

      // Update core fields
      if (dto.owner_name !== undefined) asset.owner_name = dto.owner_name;
      if (dto.mobile_number !== undefined) asset.mobile_number = dto.mobile_number;
      if (dto.source !== undefined) asset.source = dto.source;
      if (dto.mediator_name !== undefined) asset.mediator_name = dto.mediator_name;
      if (dto.cp_reference_name !== undefined) asset.cp_reference_name = dto.cp_reference_name;
      if (dto.remarks !== undefined) asset.remarks = dto.remarks;

      await queryRunner.manager.save(asset);

      if (dto.location) {
        let loc = await queryRunner.manager.findOne(AssetLocation, { where: { asset_id: id } });
        if (!loc) {
          loc = queryRunner.manager.create(AssetLocation, { asset_id: id });
        }
        Object.assign(loc, dto.location);
        await queryRunner.manager.save(loc);
      }

      if (dto.financials) {
        let fin = await queryRunner.manager.findOne(AssetFinancials, { where: { asset_id: id } });
        if (!fin) {
          fin = queryRunner.manager.create(AssetFinancials, { asset_id: id });
        }
        Object.assign(fin, dto.financials);
        await queryRunner.manager.save(fin);
      }

      if (dto.features) {
        let feat = await queryRunner.manager.findOne(AssetFeature, { where: { asset_id: id } });
        if (!feat) {
          feat = queryRunner.manager.create(AssetFeature, { asset_id: id });
        }
        Object.assign(feat, dto.features);
        await queryRunner.manager.save(feat);
      }

      if (dto.layouts && Array.isArray(dto.layouts)) {
        await queryRunner.manager.delete(AssetLayout, { asset_id: id });
        for (const layoutDto of dto.layouts) {
          await queryRunner.manager.save(queryRunner.manager.create(AssetLayout, { ...layoutDto, asset_id: id }));
        }
      }

      await queryRunner.commitTransaction();
      return this.findOne(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async uploadMedia(assetId: number, files: { document?: Express.Multer.File[], images?: Express.Multer.File[], fmb?: Express.Multer.File[], barcode?: Express.Multer.File[] }) {
    const asset = await this.dataSource.getRepository(Asset).findOne({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Asset not found');

    const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
    const MAX_DOC_SIZE = 20 * 1024 * 1024;   // 20 MB

    const validateFile = (file: Express.Multer.File, allowedTypes: string[], maxSize: number, label: string) => {
      if (!allowedTypes.includes(file.mimetype)) {
        throw new BadRequestException(`Invalid file type for ${label}: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`);
      }
      if (file.size > maxSize) {
        throw new BadRequestException(`File too large for ${label}: ${file.size} bytes. Max: ${maxSize} bytes`);
      }
    };

    // Validate all files before uploading any
    if (files.document?.length) validateFile(files.document[0], ALLOWED_DOC_TYPES, MAX_DOC_SIZE, 'document');
    if (files.fmb?.length) validateFile(files.fmb[0], ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE, 'fmb');
    if (files.barcode?.length) validateFile(files.barcode[0], ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE, 'barcode');
    if (files.images?.length) {
      for (const img of files.images.slice(0, 4)) {
        validateFile(img, ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE, 'image');
      }
    }

    const repo = this.dataSource.getRepository(AssetDocument);
    const uploadedDocs: any[] = [];

    const processFile = async (file: Express.Multer.File, type: string, category: string, prefix: string) => {
      const fileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileKey = `asset-inventory/${assetId}/${prefix}_${Date.now()}_${fileName}`;
      await this.s3Client.write(fileKey, file.buffer, { type: file.mimetype });
      const fileUrl = `${process.env.R2_PUBLIC_URL}/${fileKey}`;
      const saved = await repo.save(repo.create({
        asset_id: assetId,
        file_name: fileName,
        file_url: fileUrl,
        file_key: fileKey,
        file_type: type,
        document_category: category
      }));
      uploadedDocs.push(saved);
    };

    // Process Document (Max 1)
    if (files.document && files.document.length > 0) {
      await processFile(files.document[0], 'document', 'general', 'doc');
    }

    // Process FMB (Max 1)
    if (files.fmb && files.fmb.length > 0) {
      await processFile(files.fmb[0], 'image', 'fmb', 'fmb');
    }

    // Process Barcode (Max 1)
    if (files.barcode && files.barcode.length > 0) {
      await processFile(files.barcode[0], 'image', 'barcode', 'barcode');
    }

    // Process Images (Max 4)
    if (files.images && files.images.length > 0) {
      const imagesToProcess = files.images.slice(0, 4); // enforce max 4 just in case
      for (const imgFile of imagesToProcess) {
        await processFile(imgFile, 'image', 'general', 'img');
      }
    }

    return uploadedDocs;
  }
}
