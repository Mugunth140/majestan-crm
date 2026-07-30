import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { Asset } from '../../database/entities/asset.entity';
import { AssetLocation } from '../../database/entities/asset-location.entity';
import { AssetFinancials } from '../../database/entities/asset-financials.entity';
import { AssetFeature } from '../../database/entities/asset-feature.entity';
import { AssetLayout } from '../../database/entities/asset-layout.entity';
import { AssetDocument } from '../../database/entities/asset-document.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, AssetLocation, AssetFinancials, AssetFeature, AssetLayout, AssetDocument]), AuthModule],
  controllers: [AssetsController],
  providers: [AssetsService],
})
export class AssetsModule {}
