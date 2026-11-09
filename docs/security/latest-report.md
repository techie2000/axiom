# Security Report

**Generated:** 2026-11-09 08:01 UTC
**Workflow run:** https://github.com/techie2000/axiom/actions/runs/42582943656

> ⚠️ This file is auto-generated. Do not edit manually.
> Trigger a new run via `gh workflow run security-report.yml` to refresh.

---

## Go Vulnerabilities (govulncheck)

```text
=== Symbol Results ===

No vulnerabilities found.

Your code is affected by 0 vulnerabilities.
This scan also found 0 vulnerabilities in packages you import and 3
vulnerabilities in modules you require, but your code doesn't appear to call
these vulnerabilities.
Use '-show verbose' for more details.
```

---

## Frontend Vulnerabilities (npm audit)

```text
# npm audit report

minimatch  7.0.0 - 11.0.0
Severity: moderate
minimatch has potential denial of service via globparts amplification - https://github.com/advisories/GHSA-g3hv-75wg-m249
fix available via `npm audit fix`
node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch
  @typescript-eslint/typescript-estree  >=6.16.0
  Depends on vulnerable versions of minimatch
  node_modules/@typescript-eslint/typescript-estree
    @typescript-eslint/parser  >=6.16.0
    Depends on vulnerable versions of @typescript-eslint/typescript-estree
    node_modules/@typescript-eslint/parser
    @typescript-eslint/type-utils  >=6.16.0
    Depends on vulnerable versions of @typescript-eslint/typescript-estree
    Depends on vulnerable versions of @typescript-eslint/utils
    node_modules/@typescript-eslint/type-utils
    @typescript-eslint/utils  >=6.16.0
    Depends on vulnerable versions of @typescript-eslint/typescript-estree
    node_modules/@typescript-eslint/utils
      @typescript-eslint/eslint-plugin  >=6.16.0
      Depends on vulnerable versions of @typescript-eslint/type-utils
      Depends on vulnerable versions of @typescript-eslint/utils
      node_modules/@typescript-eslint/eslint-plugin

6 moderate severity vulnerabilities

To address all issues, run:
  npm audit fix
```

---

## Dependabot Alerts

{"message":"Resource not accessible by integration","documentation_url":"https://docs.github.com/rest/dependabot/alerts#list-dependabot-alerts-for-a-repository","status":"403"}gh: Resource not accessible by integration (HTTP 403)

---

## Code Scanning Alerts

- [WARNING] Workflow does not contain permissions — .github/workflows/markdown-lint.yml:18
- [WARNING] undici: undici: Denial of Service via unbounded WebSocket PONG buffering — usr/local/lib/node_modules/npm/node_modules/undici/package.json:1
- [WARNING] undici: undici: Denial of Service via memory exhaustion in EventSource client — usr/local/lib/node_modules/npm/node_modules/undici/package.json:1
- [ERROR] undici: undici: Denial of Service via TLS renegotiation with mismatched certificate — usr/local/lib/node_modules/npm/node_modules/undici/package.json:1
- [ERROR] undici: undici: Denial of Service via unhandled stream error on excessive content encodings — usr/local/lib/node_modules/npm/node_modules/undici/package.json:1
- [ERROR] undici: undici: Certificate validation bypass via dropped TLS options in Agent — usr/local/lib/node_modules/npm/node_modules/undici/package.json:1
- [WARNING] minimatch: minimatch: Denial of Service via crafted glob pattern expansion — app/node_modules/minimatch/package.json:1
- [WARNING] minimatch: minimatch: Denial of Service via crafted glob pattern expansion — app/node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch/package.json:1
- [WARNING] minimatch: minimatch: Denial of Service via crafted glob pattern expansion — usr/local/lib/node_modules/npm/node_modules/minimatch/package.json:1
- [WARNING] glob: glob: Denial of Service (DoS) via incomplete traversal cancellation — usr/local/lib/node_modules/npm/node_modules/glob/package.json:1
- [WARNING] ip-address: ip-address: Denial of Service via excessive percent characters in IPv6 address input — usr/local/lib/node_modules/npm/node_modules/ip-address/package.json:1
- [NOTE] In childTextNodesAreLiteral, walking up the tree previously stopped at ... — root/main:1
- [NOTE] When coalescing adjacent text nodes in addText and fosterParent, appen ... — root/main:1
- [NOTE] The golang.org/x/crypto/openpgp package is unmaintained, unsafe by design, and has known security issues — root/main:1
- [WARNING] golang-protobuf: encoding/protojson, internal/encoding/json: infinite loop in protojson.Unmarshal when unmarshaling certain forms of invalid JSON — backend/go.mod:1
- [WARNING] golang.org/x/net/html: Incorrect Neutralization of Input During Web Page Generation in x/net in golang.org/x/net — backend/go.mod:1
- [WARNING] golang.org/x/net/proxy: golang.org/x/net/http/httpproxy: HTTP Proxy bypass using IPv6 Zone IDs in golang.org/x/net — backend/go.mod:1
- [WARNING] golang: net/http, x/net/http2: unlimited number of CONTINUATION frames causes DoS — backend/go.mod:1
- [WARNING] golang.org/x/crypto/ssh: golang.org/x/crypto/ssh: Denial of Service via unbounded memory consumption in GSSAPI authentication — backend/go.mod:1
- [WARNING] golang.org/x/crypto/ssh/agent: SSH Agent servers: Denial of Service due to malformed messages — backend/go.mod:1
- [ERROR] golang.org/x/crypto/ssh: Denial of Service in the Key Exchange of golang.org/x/crypto/ssh — backend/go.mod:1
- [ERROR] golang.org/x/crypto/ssh: Misuse of ServerConfig.PublicKeyCallback may cause authorization bypass in golang.org/x/crypto — backend/go.mod:1
- [WARNING] Panic in Pipeline when PgConn is busy or closed in github.com/jackc/pgx — backend/go.mod:1
- [ERROR] pgx: SQL Injection via Protocol Message Size Overflow — backend/go.mod:1
- [ERROR] golang-jwt/jwt: jwt-go allows excessive memory allocation during header parsing — backend/go.mod:1

---

## Action Versions in Use

The following third-party GitHub Actions are pinned in this repository:

```text
uses: DavidAnson/markdownlint-cli2-action@v25
uses: actions/cache@v6
uses: actions/checkout@v6
uses: actions/checkout@v7
uses: actions/configure-pages@v6
uses: actions/deploy-pages@v5
uses: actions/github-script@v8
uses: actions/setup-go@v6
uses: actions/setup-go@v7
uses: actions/setup-node@v7
uses: actions/setup-python@v7
uses: actions/upload-pages-artifact@v5
uses: aquasecurity/trivy-action@v0.36.0
uses: docker/build-push-action@v5
uses: docker/login-action@v4
uses: docker/metadata-action@v5
uses: docker/setup-buildx-action@v4
uses: dorny/paths-filter@v4
uses: github/codeql-action/analyze@v4
uses: github/codeql-action/init@v4
uses: github/codeql-action/upload-sarif@v4
uses: golang/govulncheck-action@v1
uses: golangci/golangci-lint-action@v9
uses: peter-evans/create-pull-request@v8
uses: softprops/action-gh-release@v2
- uses: actions/checkout@v7
```

---

*To view full details, visit:*

- *Dependabot: https://github.com/techie2000/axiom/security/dependabot*
- *Code scanning: https://github.com/techie2000/axiom/security/code-scanning*
