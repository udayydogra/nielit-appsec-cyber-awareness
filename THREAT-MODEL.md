# Threat Model — NIELIT AppSec + Cyber-Awareness Platform

A STRIDE threat model for a platform whose defining tension is **giving users real offensive
capability (a live vulnerable app, a real root shell) inside a system that must not be
harmed by it.** Every mitigation below is implemented in the codebase, not aspirational.

## 1. Scope & assets

**Assets (what an attacker wants):**

| Asset | Where | Why it matters |
|---|---|---|
| User credentials | `users` (bcrypt hashes) | account takeover |
| Sessions | JWT in HttpOnly cookie, Redis | impersonation |
| Quiz answer keys | `quiz_keys` (server-side only) | integrity of assessment/certs |
| Learner PII / progress | Postgres | privacy |
| The host Docker daemon | `/var/run/docker.sock` in lab-manager | full host compromise |
| Other tenants' containers & data | Tier-3 lab boxes | cross-tenant breach |

## 2. Trust boundaries (data-flow)

```
 [ Browser ] ──TLS──▶ [ web / nginx ] ──/api──▶ [ lab-manager API ] ──▶ [ Postgres ] [ Redis ]
   untrusted            static             AUTHZ boundary             │
                                                                       ├─▶ Docker daemon (socket)
                                                                       ▼
                                                      [ Tier-3 lab container ]  ← student has root
                                                             │  (internal `labnet`, no egress)
                                                             ▼
                                                        [ apt-proxy ]  ← only reachable host
```

The two boundaries that carry the most risk: **(B1)** untrusted browser → API (every request
is hostile until authorised), and **(B2)** the student-controlled Tier-3 container → the host
and other tenants.

## 3. STRIDE

### Spoofing (identity)
- **Threat:** forged sessions / impersonation.
- **Mitigations:** JWT signed with a server secret; delivered in an **HttpOnly, SameSite=lax,
  Secure(prod)** cookie (JS/XSS can't read it); the API **never trusts a raw user id** — the
  subject comes from the verified token. `config.ts` **fails fast** in production if a signing
  secret is left at its dev default. Login is **rate-limited**.

### Tampering (integrity)
- **Threat:** modifying answer keys, other users' progress, or injected SQL/DDL.
- **Mitigations:** answer keys live only in `quiz_keys` (never shipped to the client); the
  injectable SQLi lab runs on the restricted **`nielit_lab`** role against a **session-local
  temp table**, so `UNION`/stacked writes into real tables fail with `permission denied`
  (see [`docs/writeups/sqli-sandbox-escape.md`](docs/writeups/sqli-sandbox-escape.md));
  parameterised queries everywhere else, enforced by a custom Semgrep rule.

### Repudiation (auditability)
- **Threat:** a malicious action with no trace.
- **Mitigations:** `requirePermission` **audits every authz denial and every cross-user
  access** (`audit()` with actor, action, target, path). Admin/role changes flow through
  audited routes.

### Information Disclosure (confidentiality)
- **Threat:** cross-tenant data leak; credential/answer-key dump (the escape found in review).
- **Mitigations:** the `nielit_lab` least-privilege role (blast-radius containment); **anti-BOLA
  scope resolvers** — `selfScope` (target id comes from the session, *structurally* removing
  IDOR), `cohortScope` (target must be in the caller's cohort), `containerOwnerScope` (can't
  reach another student's container); deny-by-default RBAC (20 permissions, 4 roles) enforced
  at **65 call sites across 70 routes**.

### Denial of Service (availability)
- **Threat:** resource exhaustion via container spam or mentor/LLM abuse on a ~5 GB VM.
- **Mitigations:** per-route **rate limits** (lab-start, mentor); an **atomic Redis counter
  caps Tier-3 concurrency and queues overflow**; every lab container has **memory + CPU
  limits** and is **reaped on idle (6 min) or lifetime (30 min)**; the mentor runs under a
  **shared semaphore** (never per-user).

### Elevation of Privilege (the big one — B2)
- **Threat:** a student with **root in a Tier-3 container** escaping to the host (via the
  mounted Docker socket) or pivoting to another tenant; or arbitrary egress/exfiltration.
- **Mitigations:** lab containers run with **dropped Linux capabilities** (`cap-drop`), on an
  **`internal: true` Docker network** with **no route to the internet** (the only reachable
  host is the apt-proxy), under **memory limits**, and are **disposable** (auto-reaped). The
  Docker socket is used only by the lab-manager to spawn/kill labs — never mounted into lab
  containers. Optional **gVisor (`runsc`) runtime** for the escape-focused labs.

## 4. Residual risks & assumptions

- The host Docker daemon is a high-value target; the socket is mounted into `lab-manager`
  only. A `lab-manager` RCE would be critical — hence the deny-by-default AUTHZ boundary and
  the SAST/dep/secret scanning in CI. gVisor is recommended for Tier-3 in hostile settings.
- `cap-drop` + internal network mitigate but do not *prove* the absence of a container escape;
  treat Tier-3 as semi-trusted and prefer `runsc` where the threat model demands it.
- Mentor prompt-injection is bounded: the system prompt is sent in the API's dedicated
  `system` field, never concatenated with untrusted user text.

## 5. How this model is kept honest

- **Adversarial self-review** (`tobefixing.md`) — deliberately attacking the platform; the
  SQLi escape above came from it.
- **CI security gate** — Semgrep (custom + registry rules), Trivy (deps/IaC/secrets), Gitleaks,
  and CodeQL run on every push and upload SARIF to the Security tab.
