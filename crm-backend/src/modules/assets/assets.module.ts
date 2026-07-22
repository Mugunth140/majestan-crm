import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { Asset } from '../../database/entities/asset.entity';
import { AssetLocation } from '../../database/entities/asset-location.entity';
import { AssetFinancials } from '../../database/entities/asset-financials.entity';
import { AssetFeature } from '../../database/entities/asset-feature.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, AssetLocation, AssetFinancials, AssetFeature])],
  controllers: [AssetsController],
  providers: [AssetsService],
})
export class AssetsModule {}
