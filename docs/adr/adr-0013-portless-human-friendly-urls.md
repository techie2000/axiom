# ADR-0013: Portless for Human-Friendly Local Development URLs

**Status:** Accepted
**Date:** 2026-03-15
**Decision Makers:** Engineering Team
**Context:** Axiom Local Development Experience

## Context and Problem Statement

Axiom's multi-environment Docker setup assigns port-prefixed numbers to each service so four
environments can run simultaneously on one machine without collision:

| Environment | Frontend         | Backend API      | RabbitMQ Mgmt    |
|-------------|------------------|------------------|------------------|
| main        | `localhost:43000`| `localhost:48080`| `localhost:45673`|
| dev         | `localhost:13000`| `localhost:18080`| `localhost:15673`|
| uat         | `localhost:23000`| `localhost:28080`| `localhost:25673`|
| prod        | `localhost:33000`| `localhost:38080`| `localhost:35673`|

Developers and agents must remember which port prefix maps to which environment, increasing
cognitive load, typos in curl commands, and confusion when onboarding. Browser history and
bookmarks contain only port numbers, not human-readable names.

[Portless](https://github.com/vercel-labs/portless) is an npm tool (by Vercel Labs) that replaces
port numbers with stable, named `.localhost` URLs via a lightweight local proxy:

```text
http://axiom-dev.localhost:1355          # dev frontend  (was localhost:13000)
http://api.axiom-dev.localhost:1355      # dev backend   (was localhost:18080)
http://rabbitmq.axiom-dev.localhost:1355 # dev RabbitMQ  (was localhost:15673)
```

## Decision Drivers

- **DRV-001**: Reduce cognitive load of remembering per-environment port numbers.
- **DRV-002**: Provide stable, bookmarkable URLs that communicate environment and service.
- **DRV-003**: Support all four existing environments without port-strategy changes.
- **DRV-004**: Keep the tool optional — the existing port-based URLs must continue to work.
- **DRV-005**: Minimal setup cost; no changes to Docker Compose files or `.env` files.
- **DRV-006**: Cross-platform support (Linux, macOS, Windows with Node.js ≥ 18).

## Options Considered

### Option 1: No change — keep port numbers only

**Pros:**

- Zero additional tooling to install or maintain.
- Works without Node.js on the developer machine.

**Cons:**

- Port numbers are not self-documenting.
- Sharing a URL in Slack/Teams reveals nothing about which environment it points to.
- Onboarding developers must consult the port-reference table repeatedly.

### Option 2: `/etc/hosts` aliases

**Pros:**

- No additional runtime process required.
- Works with any port number (e.g. `axiom-dev 127.0.0.1` then `http://axiom-dev:13000`).

**Cons:**

- Requires root/administrator access to edit `/etc/hosts` (Windows: `C:\Windows\System32\drivers\etc\hosts`).
- Still exposes port numbers in URLs; names + ports together is only a partial improvement.
- Manual maintenance; no tooling to add or remove entries.
- Does not provide a single-port proxy (the five-digit ports remain visible).

### Option 3: Portless — static alias registration

**Pros:**

- Named `.localhost` URLs with a single proxy port (`1355`), hiding environment-specific ports.
- `portless alias <name> <port>` registers Docker-container ports without modifying Compose files.
- Optional HTTPS via auto-generated certificates (`portless proxy start --https`).
- Git worktree support: prepends branch name as subdomain automatically.
- No root access required for the default `.localhost` TLD (resolves via loopback in all major
  browsers).
- Fully optional; existing `localhost:PORT` URLs continue to work unchanged.
- Cross-platform: Node.js binary, works on Linux, macOS, and Windows.

**Cons:**

- Requires Node.js ≥ 18 and a global npm install (`npm install -g portless`).
- Introduces a persistent local proxy process that must be running.
- The proxy port (`1355`) is still visible in URLs unless HTTPS mode is used (port 443).
- Safari requires an extra `portless hosts sync` step (`.localhost` is not auto-resolved).
- Not suitable for CI environments or production deployments.

## Decision Outcome

**Chosen Option:** Option 3 — Portless static alias registration.

### Rationale

Portless satisfies DRV-001 through DRV-006 without modifying Docker Compose files or the
port-prefix strategy already embedded in `.env.*` files and `Makefile` targets. It is strictly
additive: developers who prefer raw port numbers continue to use them. The `portless alias` command
is explicitly designed for Docker-container scenarios where portless does not start the process
itself.

The tool is adopted as an **optional developer-ergonomics enhancement**. It is not a required
dependency and is not integrated into the Docker build pipeline.

### Trade-offs Accepted

- Developers must install Node.js ≥ 18 and `portless` globally to benefit.
- A proxy process (`portless proxy start`) must be running in the background.
- Safari users need a one-time `portless hosts sync` step.

## Consequences

### Positive

- **POS-001**: Self-documenting URLs communicate environment and service at a glance.
- **POS-002**: Bookmarks and shared links are meaningful without a port-reference lookup.
- **POS-003**: Zero impact on the existing Docker Compose or `.env` configuration.
- **POS-004**: A single `make portless-setup` command registers all environments at once.

### Negative

- **NEG-001**: Additional tool to install and document for new contributors.
- **NEG-002**: Proxy process adds a background dependency on the developer workstation.
- **NEG-003**: Port `1355` still appears in non-HTTPS URLs.

### Mitigation

- **MIT-001**: Document portless as optional under a clearly labelled section in the environment
  guide so contributors who do not need it can skip it entirely.
- **MIT-002**: Provide `make portless-setup` and `scripts/portless-setup.sh` / `.ps1` to reduce
  setup to a single command.
- **MIT-003**: Advise HTTPS mode (`portless proxy start --https`) for fully portless URLs.

## Implementation

### URL mapping

| Environment | Service        | Named URL                                   | Raw URL                     |
|-------------|----------------|---------------------------------------------|-----------------------------|
| main        | Frontend       | `http://axiom-main.localhost:1355`          | `http://localhost:43000`    |
| main        | Backend API    | `http://api.axiom-main.localhost:1355`      | `http://localhost:48080`    |
| main        | RabbitMQ Mgmt  | `http://rabbitmq.axiom-main.localhost:1355` | `http://localhost:45673`    |
| dev         | Frontend       | `http://axiom-dev.localhost:1355`           | `http://localhost:13000`    |
| dev         | Backend API    | `http://api.axiom-dev.localhost:1355`       | `http://localhost:18080`    |
| dev         | RabbitMQ Mgmt  | `http://rabbitmq.axiom-dev.localhost:1355`  | `http://localhost:15673`    |
| uat         | Frontend       | `http://axiom-uat.localhost:1355`           | `http://localhost:23000`    |
| uat         | Backend API    | `http://api.axiom-uat.localhost:1355`       | `http://localhost:28080`    |
| uat         | RabbitMQ Mgmt  | `http://rabbitmq.axiom-uat.localhost:1355`  | `http://localhost:25673`    |
| prod        | Frontend       | `http://axiom-prod.localhost:1355`          | `http://localhost:33000`    |
| prod        | Backend API    | `http://api.axiom-prod.localhost:1355`      | `http://localhost:38080`    |
| prod        | RabbitMQ Mgmt  | `http://rabbitmq.axiom-prod.localhost:1355` | `http://localhost:35673`    |

With HTTPS enabled (`portless proxy start --https`) the `:1355` port suffix is removed entirely.

### Setup steps

```bash
# 1. Install portless (once per machine)
npm install -g portless

# 2. Start the proxy (once per login session or configure to auto-start)
portless proxy start          # HTTP on port 1355
# or for full HTTPS/HTTP2:
portless proxy start --https  # HTTPS on port 443 — no port in URL

# 3. Register aliases for all environments (run after starting any environment)
make portless-setup

# 4. Access environments by name
#    Dev frontend:  http://axiom-dev.localhost:1355
#    Dev API:       http://api.axiom-dev.localhost:1355
```

## References

- **REF-001**: [Portless on GitHub](https://github.com/vercel-labs/portless)
- **REF-002**: [Multi-Environment Setup](../environments/multi-environment-setup.md)
- **REF-003**: [Environment Port Reference](../environments/environment-port-reference.md)
- **REF-004**: [ADR-0007: Docker Compose Local Dev](adr-0007-docker-compose-local-dev.md)
- **REF-005**: [portless-setup.sh](../../scripts/portless-setup.sh)
- **REF-006**: [portless-setup.ps1](../../scripts/portless-setup.ps1)
