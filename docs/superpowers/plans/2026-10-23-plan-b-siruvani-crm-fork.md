# Plan B — Siruvani CRM Fork: Repo, Strip & Rebrand
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `mugunth140/siruvaniinfra-crm` GitHub repo, clone it next to the Majestan root folder, copy the CRM source, strip 7 modules (properties, builders, ads, showcases, assets, hr, inbounds), remove the site DB connection, clean up master, rebrand everything to "Siruvani Infra", and set up GitHub Actions CI/CD that publishes Docker images to GHCR.

**Architecture:** Separate forked repo seeded from `Majestan/crm/` (frontend + backend + infra skeleton). The two codebases are independent from this point — no git relationship. CI pushes `siruvani-crm-frontend:latest` and `siruvani-crm-backend:latest` to GHCR. Watchtower on the VPS picks them up automatically (Plan C).

**Tech Stack:** Next.js 14 (frontend), NestJS + TypeORM (backend), MySQL 8, GitHub Actions, Docker / GHCR, Watchtower.

## Global Constraints
- Local clone path: `/run/media/zendex/Dev/work/siruvaniinfra-crm/` (sibling of `Majestan/`, NOT inside it)
- GitHub repo: `mugunth140/siruvaniinfra-crm`
- GHCR images: `ghcr.io/mugunth140/siruvani-crm-frontend:latest` and `ghcr.io/mugunth140/siruvani-crm-backend:latest`
- DB name: `siruvani_crm` (replaces `majestan_crm` everywhere)
- Docker network: `siruvani_network`
- App name: "Siruvani Infra CRM"
- Domain: `crm.siruvaniinfra.com`
- API public URL: `https://crm.siruvaniinfra.com/api/v1`
- Modules to strip: `properties`, `builders`, `ads`, `showcases`, `assets`, `hr`, `inbounds`
- Master sub-tables to strip: property-types, road-names, registration-charges, room-names, room-dimensions, specifications, furnishing-items, utilities, amenities
- Agents module: **keep** (Siruvani may have field agents)
- No `SITE_DB` connection, no site entities, no R2, no `SITE_API_BASE_URL`

---

### Task 1: Create GitHub repo and seed local clone

**Files:** creates `/run/media/zendex/Dev/work/siruvaniinfra-crm/` from scratch

- [ ] **Step 1: Create repo on GitHub via gh CLI**

```bash
gh repo create mugunth140/siruvaniinfra-crm --private --description "Siruvani Infra CRM"
```

Expected: repo URL printed, e.g. `https://github.com/mugunth140/siruvaniinfra-crm`

- [ ] **Step 2: Clone it next to Majestan (NOT inside it)**

```bash
cd /run/media/zendex/Dev/work
git clone git@github.com:mugunth140/siruvaniinfra-crm.git
```

Expected: `/run/media/zendex/Dev/work/siruvaniinfra-crm/` directory created.

- [ ] **Step 3: Copy CRM source into the new repo**

```bash
# Copy frontend and backend
cp -r /run/media/zendex/Dev/work/Majestan/crm/crm-frontend /run/media/zendex/Dev/work/siruvaniinfra-crm/
cp -r /run/media/zendex/Dev/work/Majestan/crm/crm-backend /run/media/zendex/Dev/work/siruvaniinfra-crm/

# Copy infra skeleton (compose files, Caddyfile etc. are created fresh — copy only migrate files)
mkdir -p /run/media/zendex/Dev/work/siruvaniinfra-crm/infra/migrations
cp /run/media/zendex/Dev/work/Majestan/infra/migrate.sh /run/media/zendex/Dev/work/siruvaniinfra-crm/infra/
```

- [ ] **Step 4: Remove Majestan-specific generated/cache directories that must not be copied**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm
rm -rf crm-frontend/.next crm-frontend/node_modules crm-frontend/.fallow
rm -rf crm-backend/dist crm-backend/node_modules crm-backend/.fallow crm-backend/.mimosa
```

- [ ] **Step 5: Create root `.gitignore`**

```bash
cat > /run/media/zendex/Dev/work/siruvaniinfra-crm/.gitignore << 'EOF'
node_modules/
.env
.env.local
*.env
dist/
.next/
.fallow/
.mimosa/
EOF
```

- [ ] **Step 6: Initial commit**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm
git add .
git commit -m "chore: initial seed from Majestan CRM"
git push -u origin master
```

---

### Task 2: Strip backend modules

**Files:**
- Delete: `crm-backend/src/modules/properties/`
- Delete: `crm-backend/src/modules/builders/`
- Delete: `crm-backend/src/modules/ads/`
- Delete: `crm-backend/src/modules/showcases/`
- Delete: `crm-backend/src/modules/assets/`
- Delete: `crm-backend/src/modules/hr/`
- Delete: `crm-backend/src/modules/inbounds/`
- Modify: `crm-backend/src/app.module.ts`

- [ ] **Step 1: Delete stripped module directories**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm/crm-backend/src/modules
rm -rf properties builders ads showcases assets hr inbounds
```

- [ ] **Step 2: Delete site entity directory (no site DB)**

```bash
rm -rf /run/media/zendex/Dev/work/siruvaniinfra-crm/crm-backend/src/database/entities/site
```

- [ ] **Step 3: Rewrite `app.module.ts`**

Replace the entire file at `crm-backend/src/app.module.ts` with the following (strips all removed modules, removes site DB connection, removes site entity imports):

```typescript
import { Module } from '@nestjs/common';
import { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import pinoHttp from 'pino-http';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { HealthModule } from './modules/health/health.module';
import { MasterModule } from './modules/master/master.module';
import { LeadsModule } from './modules/leads/leads.module';
import { AgentsModule } from './modules/agents/agents.module';
import { LeadRoutingModule } from './modules/lead-routing/lead-routing.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ContactLogsModule } from './modules/contact-logs/contact-logs.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { MailModule } from './modules/mail/mail.module';
import { CommunicationsModule } from './modules/communications/communications.module';

import { ActivityLog } from './database/entities/activity-log.entity';
import { Department } from './database/entities/department.entity';
import { Permission } from './database/entities/permission.entity';
import { RolePermission } from './database/entities/role-permission.entity';
import { UserPermission } from './database/entities/user-permission.entity';
import { Role } from './database/entities/role.entity';
import { User } from './database/entities/user.entity';
import { LeadSource } from './database/entities/lead-source.entity';
import { Lead } from './database/entities/lead.entity';
import { LeadInquiry } from './database/entities/lead-inquiry.entity';
import { WebsiteEnquiryEvent } from './database/entities/website-enquiry-event.entity';
import { LeadFollowUp } from './database/entities/lead-follow-up.entity';
import { LeadDocument } from './database/entities/lead-document.entity';
import { ContactLog } from './database/entities/contact-log.entity';
import { Agent } from './database/entities/agent.entity';
import { AgentFollowUp } from './database/entities/agent-follow-up.entity';
import { AgentContactLog } from './database/entities/agent-contact-log.entity';
import { RoutingHistory } from './database/entities/routing-history.entity';
import { Notification } from './database/entities/notification.entity';
import { TaskTemplate } from './database/entities/task-template.entity';
import { TaskMetricTarget } from './database/entities/task-metric-target.entity';
import { TaskMetricProgress } from './database/entities/task-metric-progress.entity';
import { TaskActivityLog } from './database/entities/task-activity-log.entity';
import { TaskReceipt } from './database/entities/task-receipt.entity';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', 'mysql'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('CRM_DB_NAME', 'siruvani_crm'),
        entities: [
          User, Role, Permission, RolePermission, UserPermission, Department,
          ActivityLog, LeadSource, Lead, LeadInquiry, WebsiteEnquiryEvent,
          LeadFollowUp, LeadDocument, ContactLog, Agent, AgentFollowUp,
          AgentContactLog, RoutingHistory, Notification, TaskTemplate,
          TaskMetricTarget, TaskMetricProgress, TaskActivityLog, TaskReceipt,
        ],
        synchronize: false,
        extra: {
          connectionLimit: configService.get<number>('DB_CONNECTION_LIMIT', 25),
          connectTimeout: 10000,
          acquireTimeout: 10000,
        },
      }),
    }),

    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    DepartmentsModule,
    ActivityLogsModule,
    HealthModule,
    MasterModule,
    LeadsModule,
    AgentsModule,
    LeadRoutingModule,
    NotificationsModule,
    ContactLogsModule,
    TasksModule,
    MetricsModule,
    ProjectsModule,
    MailModule,
    CommunicationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
    consumer.apply(pinoHttp({
      customProps: (req: any) => ({ reqId: (req as any).id }),
      autoLogging: { ignore: (req: any) => req.url?.includes('health') || false },
    })).forRoutes('*');
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles (no import errors)**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm/crm-backend
npm install
npx tsc --noEmit
```

Expected: exits 0, no errors about missing modules or missing entities.

- [ ] **Step 5: Commit**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm
git add crm-backend/
git commit -m "feat: strip properties/builders/ads/showcases/assets/hr/inbounds modules"
```

---

### Task 3: Strip master sub-tables (property-specific)

**Files:**
- Modify: `crm-backend/src/modules/master/master.controller.ts`
- Modify: `crm-backend/src/modules/master/master.service.ts`
- Modify: `crm-backend/src/modules/master/master.module.ts`
- Delete entities: `property-type.entity.ts`, `road-name.entity.ts`, `registration-charge.entity.ts`, `room-name.entity.ts`, `room-dimension.entity.ts`, `specification.entity.ts`
  (furnishing and utilities live in the site DB — also removed; amenities too)

- [ ] **Step 1: Identify entity files to delete**

```bash
ls /run/media/zendex/Dev/work/siruvaniinfra-crm/crm-backend/src/database/entities/
```

Check for: `property-type.entity.ts`, `road-name.entity.ts`, `registration-charge.entity.ts`, `room-name.entity.ts`, `room-dimension.entity.ts`, `specification.entity.ts`

- [ ] **Step 2: Delete them**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm/crm-backend/src/database/entities
rm -f property-type.entity.ts road-name.entity.ts registration-charge.entity.ts \
       room-name.entity.ts room-dimension.entity.ts specification.entity.ts
```

- [ ] **Step 3: Open `master.controller.ts` and delete these route groups entirely**

Remove the following sections from `crm-backend/src/modules/master/master.controller.ts`:
- `// ---- Road Names ----` block (getRoadNames, getAllRoadNames, createRoadName, updateRoadName, deleteRoadName)
- `// ---- Registration Charges ----` block
- `// ---- Furnishing Items ----` block
- `// ---- Utilities ----` block
- `// ---- Room Names ----` block
- `// ---- Room Dimensions ----` block
- `// ---- Specifications ----` block
- `// ---- Property Types ----` block
- `// ---- Amenities (site table) ----` block

Keep: `// ---- Cities ----`, `// ---- Sublocations ----`, `// ---- Projects ----`, `// ---- Lead Sources ----`

- [ ] **Step 4: Open `master.service.ts` and delete corresponding service methods**

Remove all methods related to: roadNames, registrationCharges, furnishingItems, utilities, roomNames, roomDimensions, specifications, propertyTypes, amenities.

Keep all methods for: cities, sublocations, projects, leadSources.

- [ ] **Step 5: Open `master.module.ts` and remove TypeORM entity registrations for deleted entities**

Remove `PropertyType`, `RoadName`, `RegistrationCharge`, `RoomName`, `RoomDimension`, `Specification` from `TypeOrmModule.forFeature([...])` and their imports.

- [ ] **Step 6: Verify TypeScript still compiles**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm/crm-backend
npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm
git add crm-backend/
git commit -m "feat: strip property-specific master sub-tables"
```

---

### Task 4: Strip frontend pages

**Files:**
- Delete: `crm-frontend/src/app/(dashboard)/properties/`
- Delete: `crm-frontend/src/app/(dashboard)/builders/`
- Delete: `crm-frontend/src/app/(dashboard)/ads/`
- Delete: `crm-frontend/src/app/(dashboard)/showcases/`
- Delete: `crm-frontend/src/app/(dashboard)/asset-inventory/`
- Delete: `crm-frontend/src/app/(dashboard)/hr/`
- Delete: `crm-frontend/src/app/(dashboard)/inbound/`

- [ ] **Step 1: Delete the page directories**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm/crm-frontend/src/app/\(dashboard\)
rm -rf properties builders ads showcases asset-inventory hr inbound
```

- [ ] **Step 2: Remove sidebar/nav links for stripped pages**

Search for nav items linking to stripped pages:

```bash
grep -r "properties\|builders\|asset-inventory\|showcases\|/ads\|/hr\|/inbound" \
  /run/media/zendex/Dev/work/siruvaniinfra-crm/crm-frontend/src/components/ \
  /run/media/zendex/Dev/work/siruvaniinfra-crm/crm-frontend/src/app/\(dashboard\)/layout.tsx \
  --include="*.tsx" --include="*.ts" -l
```

Open each file found and remove the nav entries (links/icons) for the deleted pages. Do not delete entire nav files — only remove the specific list items for the stripped modules.

- [ ] **Step 3: Verify Next.js build compiles**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm/crm-frontend
npm install
npm run build 2>&1 | tail -30
```

Expected: build succeeds. If there are import errors for stripped pages, find and remove those imports.

- [ ] **Step 4: Commit**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm
git add crm-frontend/
git commit -m "feat: strip frontend pages for removed modules"
```

---

### Task 5: Rebrand — replace all Majestan references

**Files:** multiple files across `crm-frontend/` and `crm-backend/`

- [ ] **Step 1: Global text replacement — app name**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm

# Replace in source files (not .env — handled separately)
find crm-frontend/src crm-backend/src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" \) \
  -exec sed -i \
    -e 's/Majestan CRM/Siruvani Infra CRM/g' \
    -e 's/majestan_crm/siruvani_crm/g' \
    -e 's/majestanrealty\.com/siruvaniinfra.com/g' \
    -e 's/majestan_network/siruvani_network/g' \
    {} +
```

- [ ] **Step 2: Replace in package.json files**

```bash
sed -i 's/"name": "crm-frontend"/"name": "siruvani-crm-frontend"/' crm-frontend/package.json
sed -i 's/"name": "crm-backend"/"name": "siruvani-crm-backend"/' crm-backend/package.json
```

- [ ] **Step 3: Update `crm-backend/.env.example`**

```bash
cat > /run/media/zendex/Dev/work/siruvaniinfra-crm/crm-backend/.env.example << 'EOF'
# Mail Configuration (Stalwart)
SMTP_HOST=stalwart-mail
SMTP_PORT=587
SMTP_USER=admin@siruvaniinfra.com
SMTP_PASS=secret
SMTP_FROM_NAME="Siruvani Infra CRM"
SMTP_FROM_EMAIL=no-reply@siruvaniinfra.com

# Communications (WhatsApp Meta API)
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_API_VERSION=v19.0

# Communications (SMS)
SMS_API_METHOD=POST
SMS_API_URL=https://api.msg91.com/api/v5/flow/
SMS_API_KEY=
SMS_SENDER_ID=SIRUVA
EOF
```

- [ ] **Step 4: Update browser tab title / metadata in frontend**

Open `crm-frontend/src/app/layout.tsx`. Find the metadata export and update:

```typescript
export const metadata: Metadata = {
  title: 'Siruvani Infra CRM',
  description: 'Siruvani Infra CRM',
};
```

- [ ] **Step 5: Replace any logo image or alt text referencing "Majestan"**

```bash
grep -r "Majestan\|majestan" crm-frontend/src --include="*.tsx" --include="*.ts" -l
```

Open each file found and replace remaining "Majestan" text with "Siruvani Infra".

- [ ] **Step 6: Verify no "Majestan" strings remain in source (excluding .git)**

```bash
grep -r "Majestan\|majestanrealty\|majestan_crm\|majestan_network" \
  crm-frontend/src crm-backend/src --include="*.ts" --include="*.tsx"
```

Expected: no output (zero matches).

- [ ] **Step 7: Commit**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm
git add -A
git commit -m "feat: rebrand to Siruvani Infra CRM"
```

---

### Task 6: Create infra files in repo

**Files:**
- Create: `infra/docker-compose.yml`
- Create: `infra/Caddyfile`
- Create: `infra/init.sql`
- Create: `infra/.env.example`
- Create: `docker-compose.yml` (root — CRM app services)
- Create: `docker-compose.yml` (Watchtower section added)

- [ ] **Step 1: Create `infra/init.sql`**

```bash
cat > /run/media/zendex/Dev/work/siruvaniinfra-crm/infra/init.sql << 'EOF'
CREATE DATABASE IF NOT EXISTS siruvani_crm;
EOF
```

- [ ] **Step 2: Create `infra/.env.example`**

```bash
cat > /run/media/zendex/Dev/work/siruvaniinfra-crm/infra/.env.example << 'EOF'
MYSQL_ROOT_PASSWORD=changeme
MYSQL_DATABASE=siruvani_crm
MEILI_MASTER_KEY=changeme
MEILI_ENV=production
MEILI_NO_ANALYTICS=true
EOF
```

- [ ] **Step 3: Create `infra/Caddyfile`**

```bash
cat > /run/media/zendex/Dev/work/siruvaniinfra-crm/infra/Caddyfile << 'EOF'
crm.siruvaniinfra.com {
    encode gzip zstd

    reverse_proxy /api/* siruvani-crm-backend:8000 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    reverse_proxy * siruvani-crm-frontend:4000 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    header {
        X-Content-Type-Options nosniff
        X-Frame-Options SAMEORIGIN
        Referrer-Policy strict-origin-when-cross-origin
        -Server
    }

    log {
        output file /var/log/caddy/crm.log {
            roll_size 10mb
            roll_keep 5
        }
    }
}

mail.siruvaniinfra.com {
    reverse_proxy stalwart-mail:8080 {
        header_up -Forwarded
        header_up X-Forwarded-For {remote_host}
        header_up X-Real-IP {remote_host}
    }
}
EOF
```

- [ ] **Step 4: Create `infra/docker-compose.yml`**

```bash
cat > /run/media/zendex/Dev/work/siruvaniinfra-crm/infra/docker-compose.yml << 'EOF'
services:
  mysql:
    image: mysql:8.0
    env_file: .env
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=${MYSQL_DATABASE}
    ports:
      - "3307:3306"
    volumes:
      - siruvani_mysql_data:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-uroot", "-p${MYSQL_ROOT_PASSWORD}"]
      interval: 5s
      timeout: 5s
      retries: 20
      start_period: 20s
    networks:
      - siruvani_network
    restart: unless-stopped

  db-migrate:
    image: mysql:8.0
    restart: "no"
    depends_on:
      mysql:
        condition: service_healthy
    environment:
      DB_HOST: mysql
      DB_PORT: "3306"
      DB_USER: root
      DB_PASS: ${MYSQL_ROOT_PASSWORD}
      DB_NAME: siruvani_crm
    volumes:
      - ./migrations:/migrations:ro
      - ./migrate.sh:/migrate.sh:ro
    entrypoint: ["bash", "/migrate.sh"]
    networks:
      - siruvani_network

  meilisearch:
    image: getmeili/meilisearch:v1.12
    env_file: .env
    environment:
      - MEILI_MASTER_KEY=${MEILI_MASTER_KEY}
      - MEILI_ENV=${MEILI_ENV:-production}
      - MEILI_NO_ANALYTICS=${MEILI_NO_ANALYTICS:-true}
    volumes:
      - siruvani_meilisearch_data:/meili_data
    networks:
      - siruvani_network
    restart: unless-stopped

  imgproxy:
    image: ghcr.io/imgproxy/imgproxy:latest-amd64
    networks:
      - siruvani_network
    restart: unless-stopped

  stalwart:
    image: stalwartlabs/stalwart:latest
    container_name: stalwart-mail
    restart: unless-stopped
    ports:
      - "25:25"
      - "143:143"
      - "993:993"
      - "587:587"
      - "465:465"
      - "127.0.0.1:18080:8080"
    environment:
      STALWART_PUBLIC_URL: https://mail.siruvaniinfra.com
    volumes:
      - siruvani_mail_etc:/etc/stalwart
      - siruvani_mail_data:/var/lib/stalwart
    networks:
      - siruvani_network

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - siruvani_caddy_data:/data
      - siruvani_caddy_config:/config
      - siruvani_caddy_logs:/var/log/caddy
    networks:
      - siruvani_network
    restart: unless-stopped

volumes:
  siruvani_mysql_data:
    external: true
  siruvani_meilisearch_data:
    external: true
  siruvani_caddy_data:
    external: true
  siruvani_caddy_config:
    external: true
  siruvani_caddy_logs:
    external: true
  siruvani_mail_etc:
    external: true
  siruvani_mail_data:
    external: true
  siruvani_mail_webmail:
    external: true

networks:
  siruvani_network:
    external: true
EOF
```

- [ ] **Step 5: Create root `docker-compose.yml` (CRM app + Watchtower)**

```bash
cat > /run/media/zendex/Dev/work/siruvaniinfra-crm/docker-compose.yml << 'EOF'
services:
  siruvani-crm-frontend:
    image: ghcr.io/mugunth140/siruvani-crm-frontend:latest
    container_name: siruvani-crm-frontend
    ports:
      - "4000:4000"
    env_file: .env
    environment:
      BACKEND_URL: http://siruvani-crm-backend:8000
    networks:
      - siruvani_network
    restart: unless-stopped

  siruvani-crm-backend:
    image: ghcr.io/mugunth140/siruvani-crm-backend:latest
    container_name: siruvani-crm-backend
    ports:
      - "8000:8000"
    env_file: .env
    networks:
      - siruvani_network
    restart: unless-stopped

  watchtower:
    image: containrrr/watchtower
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /root/.docker/config.json:/config.json:ro
    environment:
      - WATCHTOWER_POLL_INTERVAL=300
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_INCLUDE_STOPPED=false
    # shortcut: monitors ALL containers on this host, not just CRM ones.
    # When more services are added that should NOT auto-update, pass explicit
    # container names as command args instead of env-var scoping.
    networks:
      - siruvani_network

networks:
  siruvani_network:
    external: true
EOF
```

- [ ] **Step 6: Create `infra/.gitignore`**

```bash
echo ".env" > /run/media/zendex/Dev/work/siruvaniinfra-crm/infra/.gitignore
```

- [ ] **Step 7: Commit infra files**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm
git add infra/ docker-compose.yml
git commit -m "feat: add infra stack and docker-compose with Watchtower"
```

---

### Task 7: Create migrations for Siruvani (kept tables only)

**Files:**
- Create: `infra/migrations/001_initial_schema.sql` (stripped version — no property/asset/hr/inbound tables)

- [ ] **Step 1: Create Siruvani's initial schema migration**

This migration covers only the tables for kept modules. Create the file:

`/run/media/zendex/Dev/work/siruvaniinfra-crm/infra/migrations/001_initial_schema.sql`

```sql
-- 001_initial_schema.sql
-- Siruvani Infra CRM baseline schema.
-- Kept modules: auth, users, roles, departments, permissions, leads,
--   agents, lead-routing, contact-logs, tasks, projects, notifications,
--   activity-logs, metrics, master (cities, sublocations, lead-sources).

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   VARCHAR(255) NOT NULL,
  applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
  id         INT NOT NULL AUTO_INCREMENT,
  name       VARCHAR(255) NOT NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS departments (
  id          INT NOT NULL AUTO_INCREMENT,
  name        VARCHAR(255) NOT NULL,
  description VARCHAR(500) NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  id         INT NOT NULL AUTO_INCREMENT,
  name       VARCHAR(255) NOT NULL,
  key_name   VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permission_key (key_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lead_sources (
  id         INT NOT NULL AUTO_INCREMENT,
  name       VARCHAR(255) NOT NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id              INT NOT NULL AUTO_INCREMENT,
  username        VARCHAR(255) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  password        VARCHAR(255) NOT NULL,
  display_name    VARCHAR(255) NULL,
  phone           VARCHAR(50) NULL,
  profile_image   VARCHAR(500) NULL,
  role_id         INT NULL,
  department_id   INT NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  last_login      DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_email (email),
  UNIQUE KEY uq_user_username (username),
  CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE SET NULL,
  CONSTRAINT fk_user_dept FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  id            INT NOT NULL AUTO_INCREMENT,
  role_id       INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_permissions (
  id            INT NOT NULL AUTO_INCREMENT,
  user_id       INT NOT NULL,
  permission_id INT NOT NULL,
  granted       TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  CONSTRAINT fk_up_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_up_perm FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leads (
  id              INT NOT NULL AUTO_INCREMENT,
  display_id      VARCHAR(255) NULL,
  name            VARCHAR(255) NOT NULL,
  email           VARCHAR(255) NULL,
  phone           VARCHAR(50) NULL,
  alternate_phone VARCHAR(50) NULL,
  source_id       INT NULL,
  assigned_to     INT NULL,
  status          VARCHAR(100) NOT NULL DEFAULT 'new',
  priority        VARCHAR(50) NULL,
  budget          DECIMAL(15,2) NULL,
  notes           TEXT NULL,
  outcome         VARCHAR(100) NULL,
  commission_remarks TEXT NULL,
  qualification_status VARCHAR(100) NULL,
  qualified_at    DATETIME NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_lead_source FOREIGN KEY (source_id) REFERENCES lead_sources (id) ON DELETE SET NULL,
  CONSTRAINT fk_lead_assigned FOREIGN KEY (assigned_to) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agents (
  id              INT NOT NULL AUTO_INCREMENT,
  display_id      VARCHAR(255) NULL,
  name            VARCHAR(255) NOT NULL,
  email           VARCHAR(255) NULL,
  phone           VARCHAR(50) NULL,
  assigned_to     INT NULL,
  assigned_staff_id INT NULL,
  status          VARCHAR(100) NOT NULL DEFAULT 'active',
  notes           TEXT NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_agent_assigned FOREIGN KEY (assigned_to) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_logs (
  id           INT NOT NULL AUTO_INCREMENT,
  user_id      INT NULL,
  action       VARCHAR(255) NOT NULL,
  entity_type  VARCHAR(100) NULL,
  entity_id    INT NULL,
  details      JSON NULL,
  ip_address   VARCHAR(50) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_al_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lead_inquiries (
  id              INT NOT NULL AUTO_INCREMENT,
  lead_id         INT NOT NULL,
  inquiry_type    VARCHAR(100) NULL,
  notes           TEXT NULL,
  qualification_status VARCHAR(100) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_li_lead FOREIGN KEY (lead_id) REFERENCES leads (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS website_enquiry_events (
  id              INT NOT NULL AUTO_INCREMENT,
  lead_id         INT NULL,
  source          VARCHAR(100) NULL,
  page_url        VARCHAR(500) NULL,
  message         TEXT NULL,
  source_message  TEXT NULL,
  acknowledged    TINYINT(1) NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_wee_lead FOREIGN KEY (lead_id) REFERENCES leads (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lead_follow_ups (
  id          INT NOT NULL AUTO_INCREMENT,
  lead_id     INT NOT NULL,
  user_id     INT NULL,
  note        TEXT NULL,
  follow_up_date DATETIME NULL,
  status      VARCHAR(100) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_lfu_lead FOREIGN KEY (lead_id) REFERENCES leads (id) ON DELETE CASCADE,
  CONSTRAINT fk_lfu_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lead_documents (
  id          INT NOT NULL AUTO_INCREMENT,
  lead_id     INT NOT NULL,
  name        VARCHAR(255) NOT NULL,
  url         VARCHAR(500) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_ld_lead FOREIGN KEY (lead_id) REFERENCES leads (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_logs (
  id            INT NOT NULL AUTO_INCREMENT,
  entity_type   VARCHAR(100) NOT NULL,
  entity_id     INT NOT NULL,
  user_id       INT NULL,
  call_type     VARCHAR(50) NULL,
  duration      INT NULL,
  notes         TEXT NULL,
  called_at     DATETIME NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_cl_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_follow_ups (
  id          INT NOT NULL AUTO_INCREMENT,
  agent_id    INT NOT NULL,
  user_id     INT NULL,
  note        TEXT NULL,
  follow_up_date DATETIME NULL,
  status      VARCHAR(100) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_afu_agent FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE,
  CONSTRAINT fk_afu_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_contact_logs (
  id          INT NOT NULL AUTO_INCREMENT,
  agent_id    INT NOT NULL,
  user_id     INT NULL,
  call_type   VARCHAR(50) NULL,
  duration    INT NULL,
  notes       TEXT NULL,
  called_at   DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_acl_agent FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE,
  CONSTRAINT fk_acl_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS routing_histories (
  id            INT NOT NULL AUTO_INCREMENT,
  lead_id       INT NULL,
  from_user_id  INT NULL,
  to_user_id    INT NULL,
  reason        TEXT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_rh_lead FOREIGN KEY (lead_id) REFERENCES leads (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id          INT NOT NULL AUTO_INCREMENT,
  user_id     INT NOT NULL,
  title       VARCHAR(255) NOT NULL,
  message     TEXT NULL,
  type        VARCHAR(100) NULL,
  is_read     TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_templates (
  id          INT NOT NULL AUTO_INCREMENT,
  name        VARCHAR(255) NOT NULL,
  description TEXT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_metric_targets (
  id           INT NOT NULL AUTO_INCREMENT,
  template_id  INT NULL,
  user_id      INT NULL,
  metric_name  VARCHAR(255) NOT NULL,
  target_value DECIMAL(15,2) NULL,
  period       VARCHAR(50) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_tmt_template FOREIGN KEY (template_id) REFERENCES task_templates (id) ON DELETE SET NULL,
  CONSTRAINT fk_tmt_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_metric_progress (
  id           INT NOT NULL AUTO_INCREMENT,
  target_id    INT NOT NULL,
  value        DECIMAL(15,2) NULL,
  noted_at     DATETIME NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_tmp_target FOREIGN KEY (target_id) REFERENCES task_metric_targets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_activity_logs (
  id          INT NOT NULL AUTO_INCREMENT,
  user_id     INT NULL,
  action      VARCHAR(255) NOT NULL,
  details     JSON NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_tal_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_receipts (
  id          INT NOT NULL AUTO_INCREMENT,
  user_id     INT NULL,
  amount      DECIMAL(15,2) NULL,
  description TEXT NULL,
  received_at DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_tr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: Commit migration**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm
git add infra/migrations/
git commit -m "feat: add initial Siruvani CRM schema migration (kept modules only)"
```

---

### Task 8: Set up GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create `.github/workflows/` directory**

```bash
mkdir -p /run/media/zendex/Dev/work/siruvaniinfra-crm/.github/workflows
```

- [ ] **Step 2: Create `deploy.yml`**

```bash
cat > /run/media/zendex/Dev/work/siruvaniinfra-crm/.github/workflows/deploy.yml << 'EOF'
name: Deploy Siruvani CRM

on:
  push:
    branches: ["master"]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  REGISTRY: ghcr.io
  FRONTEND_IMAGE: ghcr.io/mugunth140/siruvani-crm-frontend
  BACKEND_IMAGE: ghcr.io/mugunth140/siruvani-crm-backend

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GH_PAT }}

      - name: Build and push frontend
        uses: docker/build-push-action@v5
        with:
          context: ./crm-frontend
          push: true
          tags: ${{ env.FRONTEND_IMAGE }}:latest
          build-args: |
            NEXT_PUBLIC_API_URL=https://crm.siruvaniinfra.com/api/v1
            NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${{ secrets.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY }}

      - name: Build and push backend
        uses: docker/build-push-action@v5
        with:
          context: ./crm-backend
          push: true
          tags: ${{ env.BACKEND_IMAGE }}:latest

  migrate:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Run migrations on server before Watchtower picks up new images
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_IP }}
          username: root
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /opt/siruvani/infra
            docker compose run --rm db-migrate
EOF
```

- [ ] **Step 3: Commit**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm
git add .github/
git commit -m "feat: add GitHub Actions CI/CD with GHCR push and SSH migration step"
git push
```

- [ ] **Step 4: Add GitHub Actions secrets to the repo**

Go to `https://github.com/mugunth140/siruvaniinfra-crm/settings/secrets/actions` and add:

| Secret name | Value |
|-------------|-------|
| `GH_PAT` | GitHub PAT with `packages:write` scope |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key |
| `SERVER_IP` | `13.140.58.111` |
| `SERVER_SSH_KEY` | Private key from `/root/.ssh/github_deploy` on the VPS (generated in Plan A Task 5) |

---

### Task 9: Final verification — local TypeScript and build check

- [ ] **Step 1: Verify backend compiles clean**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm/crm-backend
npx tsc --noEmit
```

Expected: exits 0, zero errors.

- [ ] **Step 2: Verify frontend builds clean**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm/crm-frontend
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` or similar, no errors.

- [ ] **Step 3: Final push**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm
git status  # confirm clean
git push
```

Expected: GitHub Actions workflow triggers. Check at `https://github.com/mugunth140/siruvaniinfra-crm/actions`.
