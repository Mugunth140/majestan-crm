# Asset Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the highly normalized Asset Inventory (Land Bank) module for the CRM, tracking property information across nested 1:1 and 1:N relations.

**Architecture:** A NestJS/TypeORM backend providing full CRUD with transactional creation of nested 1:1 entities (Location, Financials, Features) alongside a Next.js (App Router) frontend utilizing a multi-step creation wizard and detailed dashboard view.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, Next.js (App Router), TailwindCSS, Shadcn UI.

## Global Constraints

- Must follow existing CRM architecture for entity definition (using `crm/crm-backend/src/database/entities`).
- All new entities must be wired up to TypeORM correctly.
- Must use App Router (`src/app/(dashboard)/asset-inventory`) in Next.js.
- Frontend must use existing generic UI components where possible.
- All backend creation MUST be wrapped in a database transaction to prevent partial inserts of 1:1 relations.

---

### Task 1: Backend Database Entities & Enums

**Files:**
- Create: `crm/crm-backend/src/database/entities/asset.entity.ts`
- Create: `crm/crm-backend/src/database/entities/asset-location.entity.ts`
- Create: `crm/crm-backend/src/database/entities/asset-financials.entity.ts`
- Create: `crm/crm-backend/src/database/entities/asset-feature.entity.ts`
- Modify: `crm/crm-backend/src/app.module.ts` (Register entities)

**Interfaces:**
- Produces: `Asset`, `AssetLocation`, `AssetFinancials`, `AssetFeature` TypeORM entities.

- [ ] **Step 1: Write tests for Entity Registration (if applicable)**
*(Note: Entity registration typically doesn't have strict unit tests, but we must verify compilation)*

- [ ] **Step 2: Create Core Asset Entity**
```typescript
// crm/crm-backend/src/database/entities/asset.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, ManyToOne } from 'typeorm';
import { User } from './user.entity';

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: true })
  owner_name: string;

  @Column({ type: 'varchar', nullable: true })
  mobile_number: string;

  @Column({ type: 'varchar', default: 'New' })
  status: string;

  @Column({ type: 'int', default: 0 })
  quality_score: number;

  @Column({ name: 'assigned_staff_id', nullable: true })
  assigned_staff_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigned_staff_id' })
  assigned_staff: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

- [ ] **Step 3: Create 1:1 Related Entities (Location)**
```typescript
// crm/crm-backend/src/database/entities/asset-location.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Asset } from './asset.entity';

@Entity('asset_locations')
export class AssetLocation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: true })
  district: string;

  @Column({ type: 'varchar', nullable: true })
  taluk: string;

  @Column({ type: 'varchar', nullable: true })
  village: string;

  @Column({ type: 'varchar', nullable: true })
  road_name: string;

  @Column({ type: 'varchar', nullable: true })
  site_location: string;

  @Column({ type: 'text', nullable: true })
  google_pin: string;

  @Column({ type: 'varchar', nullable: true })
  distance_from_main: string;

  @OneToOne(() => Asset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @Column({ name: 'asset_id' })
  asset_id: number;
}
```

- [ ] **Step 4: Create 1:1 Related Entities (Financials & Features)**
```typescript
// crm/crm-backend/src/database/entities/asset-financials.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Asset } from './asset.entity';

@Entity('asset_financials')
export class AssetFinancials {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  land_price: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  dtcp_price: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  expectation: number;

  @Column({ type: 'varchar', nullable: true })
  payment_options: string;

  @OneToOne(() => Asset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @Column({ name: 'asset_id' })
  asset_id: number;
}
```

```typescript
// crm/crm-backend/src/database/entities/asset-feature.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Asset } from './asset.entity';

@Entity('asset_features')
export class AssetFeature {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: true })
  extent: string;

  @Column({ type: 'varchar', nullable: true })
  soil_type: string;

  @Column({ type: 'varchar', nullable: true })
  water_source: string;

  @Column({ type: 'boolean', default: false })
  near_railway: boolean;

  @Column({ type: 'boolean', default: false })
  near_water_body: boolean;

  @OneToOne(() => Asset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @Column({ name: 'asset_id' })
  asset_id: number;
}
```

- [ ] **Step 5: Register Entities in App Module**
Add the new entities to the `TypeOrmModule.forRoot` or `.forFeature` arrays inside `crm/crm-backend/src/app.module.ts`.

- [ ] **Step 6: Commit**
```bash
git add crm/crm-backend/src/database/entities/ crm/crm-backend/src/app.module.ts
git commit -m "feat: add asset inventory base entities"
```

### Task 2: Backend Module, Service & Controller

**Files:**
- Create: `crm/crm-backend/src/modules/assets/assets.module.ts`
- Create: `crm/crm-backend/src/modules/assets/assets.controller.ts`
- Create: `crm/crm-backend/src/modules/assets/assets.service.ts`
- Create: `crm/crm-backend/src/modules/assets/dto/create-asset.dto.ts`

**Interfaces:**
- Consumes: The `Asset`, `AssetLocation`, `AssetFinancials`, `AssetFeature` entities.
- Produces: REST endpoints `GET /assets`, `POST /assets`.

- [ ] **Step 1: Create DTOs**
```typescript
// crm/crm-backend/src/modules/assets/dto/create-asset.dto.ts
export class CreateAssetDto {
  owner_name: string;
  mobile_number: string;
  location: { district?: string; site_location?: string; google_pin?: string; };
  financials: { land_price?: number; };
  features: { extent?: string; soil_type?: string; };
}
```

- [ ] **Step 2: Create Service with Transactions**
```typescript
// crm/crm-backend/src/modules/assets/assets.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Asset } from '../../database/entities/asset.entity';
import { AssetLocation } from '../../database/entities/asset-location.entity';
import { AssetFinancials } from '../../database/entities/asset-financials.entity';
import { AssetFeature } from '../../database/entities/asset-feature.entity';
import { CreateAssetDto } from './dto/create-asset.dto';

@Injectable()
export class AssetsService {
  constructor(private dataSource: DataSource) {}

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
}
```

- [ ] **Step 3: Create Controller & Module**
*(Standard NestJS controller and module wiring, registering AssetsService and the controller, then adding to app.module.ts)*

- [ ] **Step 4: Commit**
```bash
git add crm/crm-backend/src/modules/assets/
git commit -m "feat: add assets service and controller with transactional creation"
```

### Task 3: Frontend Asset List Page

**Files:**
- Create/Modify: `crm/crm-frontend/src/app/(dashboard)/asset-inventory/page.tsx`

**Interfaces:**
- Consumes: `GET /assets` from the NestJS backend.

- [ ] **Step 1: Fetch and display Assets**
```tsx
// crm/crm-frontend/src/app/(dashboard)/asset-inventory/page.tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AssetInventoryPage() {
  const [assets, setAssets] = useState([]);

  useEffect(() => {
    // Basic fetch example; use existing CRM proxy/fetcher if available
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/assets`)
      .then(res => res.json())
      .then(data => setAssets(data));
  }, []);

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-bold tracking-tight">Asset Inventory</h1>
        <Link href="/asset-inventory/new" className="bg-primary text-primary-foreground px-4 py-2 rounded-md">
          Add Asset
        </Link>
      </div>
      <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-4 font-medium">ID</th>
              <th className="p-4 font-medium">Owner</th>
              <th className="p-4 font-medium">Mobile</th>
              <th className="p-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset: any) => (
              <tr key={asset.id} className="border-b">
                <td className="p-4">#{asset.id}</td>
                <td className="p-4">{asset.owner_name}</td>
                <td className="p-4">{asset.mobile_number}</td>
                <td className="p-4">{asset.status}</td>
              </tr>
            ))}
            {assets.length === 0 && (
              <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No assets found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add crm/crm-frontend/src/app/(dashboard)/asset-inventory/
git commit -m "feat: replace placeholder with real asset list view"
```

### Task 4: Frontend Creation Wizard

**Files:**
- Create: `crm/crm-frontend/src/app/(dashboard)/asset-inventory/new/page.tsx`

**Interfaces:**
- Produces: Payload sent to `POST /assets`.

- [ ] **Step 1: Implement Multi-step Wizard Shell**
```tsx
// crm/crm-frontend/src/app/(dashboard)/asset-inventory/new/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewAssetPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ owner_name: '', mobile_number: '', location: {}, financials: {}, features: {} });

  const submit = async () => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    router.push('/asset-inventory');
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">New Asset - Step {step} of 4</h1>
      <div className="bg-card border rounded-lg p-6">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">Basic Info</h2>
            <input className="border p-2 w-full rounded" placeholder="Owner Name" value={formData.owner_name} onChange={e => setFormData({...formData, owner_name: e.target.value})} />
            <input className="border p-2 w-full rounded" placeholder="Mobile Number" value={formData.mobile_number} onChange={e => setFormData({...formData, mobile_number: e.target.value})} />
            <button className="bg-primary text-primary-foreground px-4 py-2 rounded" onClick={() => setStep(2)}>Next</button>
          </div>
        )}
        {/* Step 2, 3 handling here, omitted for brevity but subagent will implement them fully */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">Financials</h2>
            <button className="bg-primary text-primary-foreground px-4 py-2 rounded mr-2" onClick={() => setStep(3)}>Back</button>
            <button className="bg-green-600 text-white px-4 py-2 rounded" onClick={submit}>Save Asset</button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add crm/crm-frontend/src/app/(dashboard)/asset-inventory/new/
git commit -m "feat: add asset creation wizard"
```
