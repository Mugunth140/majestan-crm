# Siruvani Infra CRM — Design Spec
**Date:** 2026-10-23  
**Status:** Approved  

---

## Overview

Create a rebranded, feature-stripped fork of Majestan CRM for a new client — Siruvani Infra. The fork lives in its own GitHub repo (`mugunth140/siruvaniinfra-crm`), is cloned next to the Majestan root folder (not inside it), and deploys to a dedicated VPS (`13.140.58.111`) via GitHub Actions + Watchtower (no webhook, no deploy.sh).

Both Majestan CRM and Siruvani Infra CRM are maintained independently going forward. Feature additions to Majestan are cherry-picked into Siruvani manually when applicable.

---

## 1. Repository

| Property | Value |
|----------|-------|
| GitHub repo | `mugunth140/siruvaniinfra-crm` |
| Local clone path | `/run/media/zendex/Dev/work/siruvaniinfra-crm/` |
| Branch | `master` |
| Structure | Monorepo: `crm-frontend/` + `crm-backend/` + `infra/` + root `docker-compose.yml` |

### Repo layout

```
siruvaniinfra-crm/
├── crm-frontend/              # Next.js — rebranded, stripped
├── crm-backend/               # NestJS — rebranded, stripped
├── infra/
│   ├── docker-compose.yml     # MySQL, Meilisearch, imgproxy, Stalwart, Caddy, Watchtower
│   ├── Caddyfile
│   ├── init.sql
│   ├── migrate.sh
│   └── migrations/            # Only migrations for kept modules
├── docker-compose.yml         # siruvani-crm-frontend + siruvani-crm-backend
└── .github/
    └── workflows/
        └── deploy.yml
```

---

## 2. Modules — What's Kept vs Stripped

### Stripped from backend (`crm-backend/src/modules/`)
- `properties/`
- `builders/`
- `ads/`
- `showcases/`
- `assets/`
- `hr/`
- `inbounds/`
- Master registry sub-tables tied to the above (property types, builder types, asset categories, property amenities, etc.)

### Stripped from frontend (`crm-frontend/src/app/(dashboard)/`)
- `properties/`
- `builders/`
- `ads/`
- `showcases/`
- `asset-inventory/`
- `hr/`
- `inbound/`

### Kept (both frontend + backend)
- `leads/` — lead management
- `tasks/` — task tracking
- `projects/` — project management
- `departments/` — department structure
- `roles/` — role-based access
- `users/` — user management
- `communications/` — WhatsApp, SMS, mail
- `contact-logs/` — call/contact logging
- `logger/` — call logger
- `activity-logs/` — audit trail
- `metrics/` — dashboard metrics
- `notifications/`
- `permissions/`
- `auth/`
- `master/` — core sub-tables only (not property/builder/asset-related)
- `lead-routing/`

---

## 3. Rebranding

| Item | Majestan | Siruvani Infra |
|------|----------|----------------|
| App name | Majestan CRM | Siruvani Infra CRM |
| DB name | `majestan_crm` | `siruvani_crm` |
| Site DB name | `majestan` | *(not used — no site integration)* |
| Docker network | `majestan_network` | `siruvani_network` |
| SMTP sender name | `Majestan CRM` | `Siruvani Infra CRM` |
| SMTP from email | `no-reply@majestanrealty.com` | `no-reply@siruvaniinfra.com` |
| R2 bucket | `majestan-properties` | *(not used — no property assets)* |
| CDN URL | `cdn.majestanrealty.com` | *(not used)* |
| Domain | `prismark.in` | `crm.siruvaniinfra.com` |
| JWT secret | `majestan_crm_super_secret_jwt_key` | new strong secret |
| GHCR image (frontend) | `ghcr.io/mugunth140/crm-frontend` | `ghcr.io/mugunth140/siruvani-crm-frontend` |
| GHCR image (backend) | `ghcr.io/mugunth140/crm-backend` | `ghcr.io/mugunth140/siruvani-crm-backend` |
| Stalwart public URL | `mail.majestanrealty.com` | `mail.siruvaniinfra.com` *(or omit if no mail domain yet)* |
| Site API integration | present | removed entirely |

---

## 4. CI/CD Pipeline

### GitHub Actions (`.github/workflows/deploy.yml`)

Trigger: push to `master`

Steps:
1. Log in to GHCR using `secrets.GH_PAT`
2. Build and push `siruvani-crm-frontend:latest` (build-arg: `NEXT_PUBLIC_API_URL=https://crm.siruvaniinfra.com/api/v1`)
3. Build and push `siruvani-crm-backend:latest`
4. SSH into `13.140.58.111` and run `docker compose run --rm db-migrate` in the `infra/` directory

> Migrations run via SSH step **before** Watchtower picks up new images, preserving the migrate-before-restart order.

### Watchtower (on VPS)

- Runs as a container in `infra/docker-compose.yml`
- Polls GHCR every **5 minutes** (`--interval 300`)
- Monitors only: `siruvani-crm-frontend`, `siruvani-crm-backend`
- Does NOT monitor infra containers (MySQL, Caddy, etc.) — those are managed manually
- Needs GHCR credentials passed via `config.json` volume mount

---

## 5. Server Setup (`13.140.58.111`)

### One-time bootstrap (manual, SSH as root)
1. Install Docker Engine + Docker Compose plugin
2. `docker network create siruvani_network`
3. Create named volumes: `siruvani_mysql_data`, `siruvani_caddy_data`, `siruvani_caddy_config`, `siruvani_caddy_logs`, `siruvani_meilisearch_data`, `siruvani_mail_etc`, `siruvani_mail_data`, `siruvani_mail_webmail`
4. `docker login ghcr.io -u mugunth140 -p <PAT>` (stored for Watchtower)
5. Place `.env` files (infra and crm)
6. `cd infra && docker compose up -d`
7. `cd .. && docker compose up -d`

### Services (`infra/docker-compose.yml`)

| Service | Image | Purpose |
|---------|-------|---------|
| `mysql` | `mysql:8.0` | Primary DB (`siruvani_crm`) |
| `db-migrate` | `mysql:8.0` | One-shot migration runner |
| `meilisearch` | `getmeili/meilisearch:v1.12` | Search |
| `imgproxy` | `ghcr.io/imgproxy/imgproxy:latest-amd64` | Image processing |
| `stalwart` | `stalwartlabs/stalwart` | Mail server |
| `caddy` | `caddy:2-alpine` | Reverse proxy + TLS |
| `watchtower` | `containrrr/watchtower` | Auto-deploy on image update |

### Services (`docker-compose.yml` — CRM app)

| Service | Image |
|---------|-------|
| `siruvani-crm-frontend` | `ghcr.io/mugunth140/siruvani-crm-frontend:latest` |
| `siruvani-crm-backend` | `ghcr.io/mugunth140/siruvani-crm-backend:latest` |

### Caddyfile (reverse proxy rules)

```
crm.siruvaniinfra.com {
    reverse_proxy /api/* siruvani-crm-backend:8000
    reverse_proxy /* siruvani-crm-frontend:4000
}
```

---

## 6. Environment Variables

### `infra/.env`
```
MYSQL_ROOT_PASSWORD=<new strong password>
MYSQL_DATABASE=siruvani_crm
MEILI_MASTER_KEY=<new key>
MEILI_ENV=production
```

### Root `.env` (crm services)
```
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://crm.siruvaniinfra.com/api/v1

DB_HOST=mysql
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=<matches MYSQL_ROOT_PASSWORD>
DB_NAME=siruvani_crm
CRM_DB_NAME=siruvani_crm

JWT_SECRET=<new strong secret>
FRONTEND_URL=https://crm.siruvaniinfra.com

SMTP_HOST=localhost
SMTP_PORT=587
SMTP_USER=admin@siruvaniinfra.com
SMTP_PASS=<stalwart admin password>
SMTP_FROM_NAME=Siruvani Infra CRM
SMTP_FROM_EMAIL=no-reply@siruvaniinfra.com

WHATSAPP_API_TOKEN=<siruvani token>
WHATSAPP_PHONE_NUMBER_ID=<siruvani phone number id>
WHATSAPP_BUSINESS_ACCOUNT_ID=<siruvani business account id>
WHATSAPP_API_VERSION=v19.0

SMS_API_METHOD=POST
SMS_API_URL=https://api.msg91.com/api/v5/flow/
SMS_API_KEY=<siruvani sms key>
SMS_SENDER_ID=SIRUVA

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<siruvani maps key or reuse>
```

> R2, SITE_API_BASE_URL, SITE_SERVICE_*, SITE_TO_CRM_SERVICE_KEY — all removed (not needed).

---

## 7. GitHub Actions Secrets (for `siruvaniinfra-crm` repo)

| Secret | Value |
|--------|-------|
| `GH_PAT` | GitHub PAT with `packages:write` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key |
| `SERVER_IP` | `13.140.58.111` |
| `SERVER_SSH_KEY` | Private SSH key for deploy user on VPS |

---

## 8. Maintenance Model

| Concern | Majestan CRM | Siruvani Infra CRM |
|---------|-------------|-------------------|
| Repo | `Majestan/crm` (existing) | `mugunth140/siruvaniinfra-crm` |
| Deploy trigger | Webhook on VPS | Watchtower polls GHCR |
| Migrations | `deploy.sh` via webhook | GitHub Actions SSH step |
| Feature sync | Source of truth | Cherry-pick from Majestan as needed |
| Infra | Majestan VPS | `13.140.58.111` |

---

## 9. Out of Scope

- No R2/CDN setup (no property assets)
- No site-to-CRM integration (Siruvani has no public website CRM bridge)
- No data migration from Majestan DB
- Stalwart mail domain (`mail.siruvaniinfra.com`) DNS — client must set MX/SPF/DKIM records separately
