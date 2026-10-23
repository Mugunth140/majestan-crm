# Plan C — First Deploy & Verification
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trigger the first production deploy of Siruvani Infra CRM — push images to GHCR via GitHub Actions, run DB migrations on the server via SSH, start the CRM app containers, confirm Watchtower is polling, and verify the app is live at `https://crm.siruvaniinfra.com`.

**Architecture:** After Plan A (server bootstrapped) and Plan B (repo built and CI set up), this plan wires everything together: first image push → migration run → container start → Watchtower takes over for future deploys.

**Tech Stack:** GitHub Actions, GHCR, Docker Compose, Watchtower, Caddy (TLS), MySQL 8.

## Global Constraints
- Server: `root@13.140.58.111`
- App dir on server: `/opt/siruvani/`
- Infra dir on server: `/opt/siruvani/infra/`
- Domain: `crm.siruvaniinfra.com`
- Docker network: `siruvani_network`
- Images: `ghcr.io/mugunth140/siruvani-crm-frontend:latest`, `ghcr.io/mugunth140/siruvani-crm-backend:latest`

---

### Task 1: Trigger first CI build and confirm images published

- [ ] **Step 1: Push to master to trigger GitHub Actions**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm
# If no outstanding commits, make a trivial one to trigger CI
git commit --allow-empty -m "chore: trigger first CI build"
git push
```

- [ ] **Step 2: Monitor the Actions run**

Open: `https://github.com/mugunth140/siruvaniinfra-crm/actions`

Watch `build-and-push` job complete. Expected: both frontend and backend images pushed successfully. Total time ~5–10 minutes.

- [ ] **Step 3: Confirm images exist in GHCR**

```bash
# From local machine or server (must be logged into ghcr.io)
docker manifest inspect ghcr.io/mugunth140/siruvani-crm-frontend:latest
docker manifest inspect ghcr.io/mugunth140/siruvani-crm-backend:latest
```

Expected: JSON manifest printed for both. If 401/404, check `GH_PAT` secret has `packages:write` and the workflow ran successfully.

- [ ] **Step 4: Confirm migration SSH step completed**

In the Actions run, check the `migrate` job. Expected: SSH step connects to server, runs `docker compose run --rm db-migrate`, output shows `[migrate] Finished. Applied: 1, Skipped: 0, Failed: 0`.

---

### Task 2: Pull images and start CRM app containers on server

- [ ] **Step 1: SSH into server**

```bash
ssh root@13.140.58.111
```

- [ ] **Step 2: Verify migration ran (schema_migrations table populated)**

```bash
docker compose -f /opt/siruvani/infra/docker-compose.yml exec mysql \
  mysql -uroot -pSiruvani@DB2026! siruvani_crm \
  -e "SELECT filename, applied_at FROM schema_migrations;"
```

Expected: row for `001_initial_schema.sql` with an `applied_at` timestamp.

- [ ] **Step 3: Pull the CRM images**

```bash
cd /opt/siruvani
docker compose pull
```

Expected: pulls `siruvani-crm-frontend:latest` and `siruvani-crm-backend:latest` from GHCR.

- [ ] **Step 4: Start the CRM app stack**

```bash
cd /opt/siruvani
docker compose up -d
```

Expected: `siruvani-crm-frontend`, `siruvani-crm-backend`, and `watchtower` containers start.

- [ ] **Step 5: Check all containers are running**

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected output (approximately):

```
NAMES                        STATUS          PORTS
siruvani-crm-frontend        Up X seconds    0.0.0.0:4000->4000/tcp
siruvani-crm-backend         Up X seconds    0.0.0.0:8000->8000/tcp
watchtower                   Up X seconds
caddy                        Up X minutes    0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
stalwart-mail                Up X minutes    ...
mysql                        Up X minutes    0.0.0.0:3307->3306/tcp
meilisearch                  Up X minutes    ...
imgproxy                     Up X minutes    ...
```

---

### Task 3: Verify the app is live at the domain

- [ ] **Step 1: Check backend health endpoint**

```bash
curl -s https://crm.siruvaniinfra.com/api/v1/health | python3 -m json.tool
```

Expected: `{"status": "ok"}` or similar health response. If 502, check backend logs:

```bash
docker logs siruvani-crm-backend --tail 30
```

- [ ] **Step 2: Check frontend loads**

```bash
curl -sI https://crm.siruvaniinfra.com | head -5
```

Expected: `HTTP/2 200` with `content-type: text/html`.

- [ ] **Step 3: Open in browser**

Navigate to `https://crm.siruvaniinfra.com`. Expected: Siruvani Infra CRM login page loads with correct branding (no "Majestan" text visible).

- [ ] **Step 4: Check TLS certificate is valid**

```bash
echo | openssl s_client -connect crm.siruvaniinfra.com:443 2>/dev/null | openssl x509 -noout -subject -dates
```

Expected: `subject=CN=crm.siruvaniinfra.com`, valid dates shown.

---

### Task 4: Create first admin user

- [ ] **Step 1: Connect to backend container and create admin**

```bash
docker exec -it siruvani-crm-backend sh
```

Inside the container — run the NestJS seeder or insert directly via the API. Check if the backend has a seed/admin-create command:

```bash
# Check for seed script
ls /app/dist/database/ 2>/dev/null || ls /app/src/database/ 2>/dev/null
```

If a seed command exists (e.g., `npm run seed`):
```bash
cd /app && npm run seed
```

If not, insert admin user directly via MySQL:

```bash
# Exit the container first
exit

# Connect to MySQL
docker compose -f /opt/siruvani/infra/docker-compose.yml exec mysql \
  mysql -uroot -pSiruvani@DB2026! siruvani_crm
```

```sql
-- Insert Admin role
INSERT IGNORE INTO roles (name) VALUES ('Admin');

-- Insert admin user (password is bcrypt of 'Admin@Siruvani2026' — generate hash first)
-- Run this on your local machine to get the bcrypt hash:
-- node -e "const b=require('bcrypt'); b.hash('Admin@Siruvani2026', 10).then(h=>console.log(h))"
-- Then paste the hash below:
INSERT INTO users (username, email, password, display_name, role_id, is_active)
VALUES ('admin', 'admin@siruvaniinfra.com', '<BCRYPT_HASH_HERE>', 'Admin', 1, 1);
```

- [ ] **Step 2: Test login**

Navigate to `https://crm.siruvaniinfra.com/login`. Log in with `admin@siruvaniinfra.com` / `Admin@Siruvani2026`. Expected: dashboard loads.

---

### Task 5: Verify Watchtower is polling GHCR

- [ ] **Step 1: Check Watchtower logs**

```bash
docker logs watchtower --tail 20
```

Expected output includes:

```
time="..." level=info msg="Watchtower 1.x.x"
time="..." level=info msg="Starting Watchtower and scheduling first run: every 300 seconds"
time="..." level=info msg="Checking all containers (except explicitly disabled)"
time="..." level=info msg="Found new siruvani-crm-frontend:latest ..." (or "No updates found")
```

If Watchtower shows auth errors pulling from GHCR, verify `/root/.docker/config.json` has the GHCR credentials (see Plan A Task 4 Step 3).

- [ ] **Step 2: Confirm Watchtower can reach GHCR**

```bash
docker exec watchtower wget -q --spider https://ghcr.io && echo "GHCR reachable"
```

Expected: `GHCR reachable`

---

### Task 6: End-to-end smoke test

- [ ] **Step 1: Push a trivial change to master and watch Watchtower auto-deploy**

On your local machine:

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm
# Add a comment to any file
echo "# smoke test $(date)" >> crm-backend/src/app.service.ts
git add . && git commit -m "chore: smoke test auto-deploy"
git push
```

- [ ] **Step 2: Wait for CI to build (~5–8 min) then watch Watchtower pick it up (~5 min poll)**

```bash
# On server — watch in real time
watch -n 10 'docker logs watchtower --tail 5'
```

Expected: within 10 minutes of the push, Watchtower logs show it pulled the new image and restarted the backend container.

- [ ] **Step 3: Verify site still up after auto-deploy**

```bash
curl -sI https://crm.siruvaniinfra.com | head -3
```

Expected: `HTTP/2 200` — app is live and healthy after auto-restart.

- [ ] **Step 4: Revert the smoke-test commit**

```bash
cd /run/media/zendex/Dev/work/siruvaniinfra-crm
git revert HEAD --no-edit
git push
```

---

### Task 7: Document Siruvani server credentials

Store these securely (password manager, not in the repo):

| Item | Value |
|------|-------|
| Server IP | `13.140.58.111` |
| SSH user | `root` |
| Server password | `siruvani2026` (change after setup) |
| MySQL root password | `Siruvani@DB2026!` |
| Meilisearch master key | `siruvani_meili_master_key_2026` |
| JWT secret | `siruvani_crm_jwt_secret_change_me_2026` (change to strong random value) |
| Stalwart admin URL | `http://13.140.58.111:18080` |
| GitHub repo | `https://github.com/mugunth140/siruvaniinfra-crm` |
| GHCR frontend image | `ghcr.io/mugunth140/siruvani-crm-frontend:latest` |
| GHCR backend image | `ghcr.io/mugunth140/siruvani-crm-backend:latest` |
| CRM URL | `https://crm.siruvaniinfra.com` |

- [ ] **Step 1: Change the root SSH password to something strong**

```bash
ssh root@13.140.58.111
passwd  # set a new strong password
```

- [ ] **Step 2: Update the JWT secret in `/opt/siruvani/.env` to a real random value**

```bash
# Generate a strong secret
openssl rand -hex 32

# Edit the env file
nano /opt/siruvani/.env
# Update JWT_SECRET=<the generated value>

# Restart backend to pick up new secret
docker compose -f /opt/siruvani/docker-compose.yml restart siruvani-crm-backend
```

**Deploy complete. Siruvani Infra CRM is live.**

Future deploys: push to `master` → GitHub Actions builds images → Watchtower picks them up within 5 minutes → zero-touch.

Migrations for future schema changes: add `NNN_description.sql` to `infra/migrations/`, commit and push — the GitHub Actions `migrate` SSH step runs them before Watchtower updates containers.
