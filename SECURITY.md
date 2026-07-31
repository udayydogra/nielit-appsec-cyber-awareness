# Security Policy

This is a security-training platform, so security is the point — both *in* the product and
*of* the product.

## Reporting a vulnerability

If you find a security issue in the platform itself (not in the intentionally-vulnerable
labs), please report it privately:

- Open a **[GitHub Security Advisory](https://github.com/udayydogra/nielit-appsec-cyber-awareness/security/advisories/new)**
  (preferred), or email the maintainer.
- Please include: affected component, reproduction steps, impact, and a suggested fix if you
  have one.
- Please **do not** open a public issue for an unpatched vulnerability.

Target response: acknowledgement within a few days; a fix or mitigation plan to follow.

## Scope

**In scope** — the platform code: `lab-manager/` (API, auth, RBAC, container manager, mentor),
`web/` (frontend), the infra (`docker-compose.yml`, provisioning), and the CI supply chain.

**Out of scope** — the *deliberately vulnerable* training targets. Code under
`lab-manager/src/vulnapp/` and the images in `lab-images/` (SQLi, XSS, SSRF, XXE,
command-injection, deserialization, path-traversal, …) is intentionally exploitable — that's
the curriculum. Reports that these "have a vulnerability" will be closed as by-design. What
*is* in scope there is a **sandbox escape** — an exploit that crosses out of a lab's intended
blast radius (e.g., reaching another tenant, the host, or real data). One such escape has
already been found and fixed:
[`docs/writeups/sqli-sandbox-escape.md`](docs/writeups/sqli-sandbox-escape.md).

## What we do on our side

- **Deny-by-default RBAC** with anti-BOLA scope resolvers and audit logging on every denial
  and cross-user access.
- **Least-privilege data access** — the injectable lab query runs on a restricted `nielit_lab`
  Postgres role that cannot reach real tables.
- **Container isolation** — Tier-3 labs run cap-dropped, on an internal network with no
  internet egress, memory-capped, and auto-reaped.
- **A CI security gate** — Semgrep (incl. custom rules), Trivy (deps/IaC/secrets), Gitleaks,
  and CodeQL run on every push; findings surface as SARIF in the Security tab.
- **Secrets never committed** — `.env` is git-ignored; provisioning generates real secrets;
  `config.ts` refuses to start in production on a dev-default signing secret.

See [`THREAT-MODEL.md`](THREAT-MODEL.md) for the full STRIDE analysis.

## Supported versions

The `main` branch is the supported version. Fixes land there first.
