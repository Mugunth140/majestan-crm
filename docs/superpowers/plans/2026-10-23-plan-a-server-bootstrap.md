# Plan A — Siruvani Server Bootstrap
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision the fresh VPS at `13.140.58.111` with Docker, the `siruvani_network`, all named volumes, and the full infra stack (MySQL, Meilisearch, imgproxy, Stalwart, Caddy) ready to serve `crm.siruvaniinfra.com` over HTTPS.

**Architecture:** All services run in Docker containers connected via a shared bridge network `siruvani_network`. Caddy handles TLS automatically via ACME/Let's Encrypt for `crm.siruvaniinfra.com`. This plan ends with infra containers running and the domain resolving — the CRM app containers come in Plan C.

**Tech Stack:** Ubuntu/Debian Linux, Docker Engine, Docker Compose plugin, Caddy 2, MySQL 8, Meilisearch v1.12, imgproxy, Stalwart mail server.

## Global Constraints
- Server: `root@13.140.58.111`, password `siruvani2026`
- Domain: `crm.siruvaniinfra.com` — DNS A record already points to `13.140.58.111`
- Docker network name: `siruvani_network`
- Volume prefix: `siruvani_`
- DB name: `siruvani_crm`
- All commands run as `root` unless noted

---

### Task 1: Install Docker Engine

**Files:** none (server-side only)

- [ ] **Step 1: SSH into the server**

```bash
ssh root@13.140.58.111
# password: siruvani2026
```

- [ ] **Step 2: Update apt and install prerequisites**

```bash
apt-get update && apt-get install -y ca-certificates curl gnupg lsb-release
```

Expected: packages install without errors.

- [ ] **Step 3: Add Docker's official GPG key and repo**

```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null
```

> If the OS is Debian (not Ubuntu), replace `ubuntu` with `debian` and use `https://download.docker.com/linux/debian`.

- [ ] **Step 4: Install Docker Engine and Compose plugin**

```bash
apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

- [ ] **Step 5: Verify**

```bash
docker version && docker compose version
```

Expected: both print version numbers without errors.

- [ ] **Step 6: Enable Docker on boot**

```bash
systemctl enable docker && systemctl start docker
```

---

### Task 2: Create network and named volumes

**Files:** none (server-side only)

- [ ] **Step 1: Create the shared bridge network**

```bash
docker network create siruvani_network
```

Expected: prints a network ID.

- [ ] **Step 2: Create all named volumes**

```bash
docker volume create siruvani_mysql_data
docker volume create siruvani_meilisearch_data
docker volume create siruvani_caddy_data
docker volume create siruvani_caddy_config
docker volume create siruvani_caddy_logs
docker volume create siruvani_mail_etc
docker volume create siruvani_mail_data
docker volume create siruvani_mail_webmail
```

- [ ] **Step 3: Verify**

```bash
docker volume ls | grep siruvani
```

Expected: 8 volumes listed.

---

### Task 3: Create server directory structure and env files

**Files:** (created on server)
- `/opt/siruvani/infra/docker-compose.yml`
- `/opt/siruvani/infra/.env`
- `/opt/siruvani/infra/Caddyfile`
- `/opt/siruvani/infra/init.sql`
- `/opt/siruvani/infra/migrate.sh`
- `/opt/siruvani/infra/migrations/` (empty dir, populated in Plan B/C)
- `/opt/siruvani/docker-compose.yml`
- `/opt/siruvani/.env`

- [ ] **Step 1: Create directory tree**

```bash
mkdir -p /opt/siruvani/infra/migrations
```

- [ ] **Step 2: Create `infra/.env`**

```bash
cat > /opt/siruvani/infra/.env << 'EOF'
MYSQL_ROOT_PASSWORD=Siruvani@DB2026!
MYSQL_DATABASE=siruvani_crm
MEILI_MASTER_KEY=siruvani_meili_master_key_2026
MEILI_ENV=production
MEILI_NO_ANALYTICS=true
EOF
```

- [ ] **Step 3: Create `infra/init.sql`**

```bash
cat > /opt/siruvani/infra/init.sql << 'EOF'
CREATE DATABASE IF NOT EXISTS siruvani_crm;
EOF
```

- [ ] **Step 4: Create `infra/migrate.sh`** (copy verbatim from Majestan — script is generic)

```bash
cat > /opt/siruvani/infra/migrate.sh << 'SCRIPT'
#!/bin/bash
set -uo pipefail

HOST="${DB_HOST:-mysql}"
PORT="${DB_PORT:-3306}"
USER="${DB_USER:-root}"
PASS="${DB_PASS}"
DB="${DB_NAME}"
MIGRATIONS_DIR="/migrations"

MYSQL="mysql -h${HOST} -P${PORT} -u${USER} -p${PASS} ${DB}"

echo "[migrate] Waiting for MySQL at ${HOST}:${PORT}..."
until mysqladmin ping -h"${HOST}" -P"${PORT}" -u"${USER}" -p"${PASS}" --silent 2>/dev/null; do
  sleep 2
done
echo "[migrate] MySQL is ready."

if ! $MYSQL -e "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   VARCHAR(255) NOT NULL,
    applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (filename)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"; then
  echo "[migrate] FATAL: could not create schema_migrations table" >&2
  exit 1
fi

applied=0; skipped=0; failed=0; failed_files=""

for filepath in $(ls "${MIGRATIONS_DIR}"/*.sql 2>/dev/null | sort); do
  filename=$(basename "$filepath")
  if ! already=$($MYSQL -sNe "SELECT COUNT(*) FROM schema_migrations WHERE filename='${filename}'"); then
    echo "[migrate] FAILED ${filename}" >&2; failed=$((failed + 1)); failed_files="${failed_files} ${filename}"; continue
  fi
  if [ "$already" -gt 0 ]; then
    echo "[migrate] SKIP   ${filename}"; skipped=$((skipped + 1)); continue
  fi
  echo "[migrate] APPLY  ${filename} ..."
  if $MYSQL < "$filepath"; then
    if $MYSQL -e "INSERT INTO schema_migrations (filename) VALUES ('${filename}')"; then
      echo "[migrate] DONE   ${filename}"; applied=$((applied + 1))
    else
      echo "[migrate] FAILED ${filename} (not recorded)" >&2; failed=$((failed + 1)); failed_files="${failed_files} ${filename}"
    fi
  else
    echo "[migrate] FAILED ${filename}" >&2; failed=$((failed + 1)); failed_files="${failed_files} ${filename}"
  fi
done

echo "[migrate] Finished. Applied: ${applied}, Skipped: ${skipped}, Failed: ${failed}"
if [ "$failed" -gt 0 ]; then echo "[migrate] FAILED:${failed_files}" >&2; exit 1; fi
SCRIPT
chmod +x /opt/siruvani/infra/migrate.sh
```

- [ ] **Step 5: Create `infra/Caddyfile`**

```bash
cat > /opt/siruvani/infra/Caddyfile << 'EOF'
crm.siruvaniinfra.com {
    encode gzip zstd

    # API requests go to backend
    reverse_proxy /api/* siruvani-crm-backend:8000 {
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # All other requests go to frontend
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

- [ ] **Step 6: Create `infra/docker-compose.yml`**

```bash
cat > /opt/siruvani/infra/docker-compose.yml << 'EOF'
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
    ports:
      - "7700:7700"
    volumes:
      - siruvani_meilisearch_data:/meili_data
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:7700/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - siruvani_network
    restart: unless-stopped

  imgproxy:
    image: ghcr.io/imgproxy/imgproxy:latest-amd64
    ports:
      - "8080:8080"
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

- [ ] **Step 7: Create root `.env` (CRM app env — placeholder values, filled properly in Plan C)**

```bash
cat > /opt/siruvani/.env << 'EOF'
NODE_ENV=production

# Frontend
NEXT_PUBLIC_API_URL=https://crm.siruvaniinfra.com/api/v1
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

# Backend — DB
DB_HOST=mysql
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=Siruvani@DB2026!
DB_NAME=siruvani_crm
CRM_DB_NAME=siruvani_crm

# Backend — Auth
JWT_SECRET=siruvani_crm_jwt_secret_change_me_2026

# Backend — URLs
FRONTEND_URL=https://crm.siruvaniinfra.com

# Backend — Mail (Stalwart)
SMTP_HOST=stalwart-mail
SMTP_PORT=587
SMTP_USER=admin@siruvaniinfra.com
SMTP_PASS=changeme
SMTP_FROM_NAME=Siruvani Infra CRM
SMTP_FROM_EMAIL=no-reply@siruvaniinfra.com

# Backend — WhatsApp
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_API_VERSION=v19.0

# Backend — SMS
SMS_API_METHOD=POST
SMS_API_URL=https://api.msg91.com/api/v5/flow/
SMS_API_KEY=
SMS_SENDER_ID=SIRUVA
EOF
```

- [ ] **Step 8: Create root `docker-compose.yml` (CRM app services — images pulled in Plan C)**

```bash
cat > /opt/siruvani/docker-compose.yml << 'EOF'
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

networks:
  siruvani_network:
    external: true
EOF
```

---

### Task 4: Authenticate Docker with GHCR

**Files:** none (server-side only)

- [ ] **Step 1: Create a GitHub PAT** (on your local machine / GitHub UI)

Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens (or classic). Scope needed: `read:packages`. Copy the token.

- [ ] **Step 2: Log Docker into GHCR on the server**

```bash
echo "<YOUR_GITHUB_PAT>" | docker login ghcr.io -u mugunth140 --password-stdin
```

Expected: `Login Succeeded`

- [ ] **Step 3: Verify credentials are stored**

```bash
cat ~/.docker/config.json | grep ghcr.io
```

Expected: shows `ghcr.io` entry with auth token. Watchtower will use this file.

---

### Task 5: Start infra stack and verify

- [ ] **Step 1: Start infra services**

```bash
cd /opt/siruvani/infra && docker compose up -d
```

Expected: MySQL, Meilisearch, imgproxy, Stalwart, Caddy start. `db-migrate` runs and exits (no migrations yet — exits cleanly).

- [ ] **Step 2: Check all containers are running**

```bash
docker compose ps
```

Expected: `mysql`, `meilisearch`, `imgproxy`, `stalwart-mail`, `caddy` all show `running`. `db-migrate` shows `exited (0)`.

- [ ] **Step 3: Check Caddy can reach the domain (TLS challenge)**

```bash
docker compose logs caddy | tail -20
```

Expected: Caddy logs show it obtained a TLS certificate for `crm.siruvaniinfra.com`. If it shows a challenge error, confirm DNS A record is propagated:

```bash
dig crm.siruvaniinfra.com +short
# should return: 13.140.58.111
```

- [ ] **Step 4: Confirm MySQL accepted the init.sql**

```bash
docker compose exec mysql mysql -uroot -pSiruvani@DB2026! -e "SHOW DATABASES;"
```

Expected: `siruvani_crm` listed.

- [ ] **Step 5: Set up a deploy SSH key for GitHub Actions**

```bash
ssh-keygen -t ed25519 -C "github-actions-siruvani" -f /root/.ssh/github_deploy -N ""
cat /root/.ssh/github_deploy.pub >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
cat /root/.ssh/github_deploy  # copy this — goes into GitHub Actions secret SERVER_SSH_KEY
```

**Server bootstrap complete.** Plan B (fork + code) and Plan C (first deploy) follow.
