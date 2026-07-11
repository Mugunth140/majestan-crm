import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inbound } from '../../database/entities/inbound.entity';
import { S3Client } from 'bun';
import { extname } from 'path';

@Injectable()
export class InboundsService {
  private _s3Client: S3Client | null = null;

  constructor(
    @InjectRepository(Inbound)
    private inboundsRepository: Repository<Inbound>,
  ) {}

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

  async uploadImage(id: number, file: Express.Multer.File) {
    const inbound = await this.findOne(id);

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Image size exceeds 5MB limit');
    }

    const fileExt = extname(file.originalname);
    const fileName = `image_${Date.now()}${fileExt}`;
    const fileKey = `inbounds/${inbound.property_id}/${fileName}`;

    await this.s3Client.write(fileKey, file.buffer, {
      type: file.mimetype,
    });

    const fileUrl = `${process.env.R2_PUBLIC_URL}/${fileKey}`;
    inbound.image_url = fileUrl;
    
    return this.inboundsRepository.save(inbound);
  }

  async create(createInboundDto: Partial<Inbound>): Promise<Inbound> {
    const newInbound = this.inboundsRepository.create(createInboundDto);
    
    // Save to get the auto-incremented ID
    let savedInbound = await this.inboundsRepository.save(newInbound);
    
    // Generate property_id: I + 5-digit padded id (e.g., I00001)
    const paddedId = savedInbound.id.toString().padStart(5, '0');
    savedInbound.property_id = `I${paddedId}`;
    
    // Save again with the property_id
    savedInbound = await this.inboundsRepository.save(savedInbound);
    
    return savedInbound;
  }

  async findAll(): Promise<Inbound[]> {
    return this.inboundsRepository.find();
  }

  async findOne(id: number): Promise<Inbound> {
    const inbound = await this.inboundsRepository.findOne({ where: { id } });
    if (!inbound) {
      throw new NotFoundException(`Inbound with ID ${id} not found`);
    }
    return inbound;
  }

  async update(id: number, updateInboundDto: Partial<Inbound>): Promise<Inbound> {
    const inbound = await this.findOne(id);
    
    // update properties (TypeORM hooks will trigger on save)
    Object.assign(inbound, updateInboundDto);
    
    return this.inboundsRepository.save(inbound);
  }

  async remove(id: number): Promise<void> {
    const inbound = await this.findOne(id);
    await this.inboundsRepository.remove(inbound);
  }
}
