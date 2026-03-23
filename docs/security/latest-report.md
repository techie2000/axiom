# Security Report

**Generated:** 2026-03-23 08:14 UTC
**Workflow run:** https://github.com/techie2000/axiom/actions/runs/23427587336

> ⚠️ This file is auto-generated. Do not edit manually.
> Trigger a new run via `gh workflow run security-report.yml` to refresh.

---

## Go Vulnerabilities (govulncheck)

```text
=== Symbol Results ===

Vulnerability #1: GO-2026-4603
    URLs in meta content attribute actions are not escaped in html/template
  More info: https://pkg.go.dev/vuln/GO-2026-4603
  Standard library
    Found in: html/template@go1.25
    Fixed in: html/template@go1.25.8
    Example traces found:
      #1: cmd/api/main.go:120:31: api.main calls http.Server.ListenAndServe, which eventually calls template.Template.Execute

Vulnerability #2: GO-2026-4602
    FileInfo can escape from a Root in os
  More info: https://pkg.go.dev/vuln/GO-2026-4602
  Standard library
    Found in: os@go1.25
    Fixed in: os@go1.25.8
    Example traces found:
      #1: cmd/api/main.go:127:15: api.main calls signal.Notify, which eventually calls os.File.Readdir
      #2: internal/service/lei_service.go:1591:26: service.leiService.CleanupOldFiles calls os.ReadDir

Vulnerability #3: GO-2026-4601
    Incorrect parsing of IPv6 host literals in net/url
  More info: https://pkg.go.dev/vuln/GO-2026-4601
  Standard library
    Found in: net/url@go1.25
    Fixed in: net/url@go1.25.8
    Example traces found:
      #1: internal/handler/handler.go:1251:32: handler.UserPreferenceHandler.SetPreference calls pgconn.ParseConfigError.Error, which eventually calls url.Parse
      #2: cmd/api/main.go:120:31: api.main calls http.Server.ListenAndServe, which eventually calls url.ParseRequestURI
      #3: internal/service/lei_service.go:321:23: service.leiService.downloadFile calls http.Get, which eventually calls url.URL.Parse

Vulnerability #4: GO-2026-4341
    Memory exhaustion in query parameter parsing in net/url
  More info: https://pkg.go.dev/vuln/GO-2026-4341
  Standard library
    Found in: net/url@go1.25
    Fixed in: net/url@go1.25.6
    Example traces found:
      #1: internal/handler/handler.go:1013:43: handler.CodeMappingHandler.List calls gin.Context.DefaultQuery, which eventually calls url.URL.Query

Vulnerability #5: GO-2026-4340
    Handshake messages may be processed at the incorrect encryption level in
    crypto/tls
  More info: https://pkg.go.dev/vuln/GO-2026-4340
  Standard library
    Found in: crypto/tls@go1.25
    Fixed in: crypto/tls@go1.25.6
    Example traces found:
      #1: cmd/api/main.go:120:31: api.main calls http.Server.ListenAndServe, which eventually calls tls.Conn.HandshakeContext
      #2: internal/service/lei_service.go:614:27: service.leiService.extractZipFile calls io.Copy, which eventually calls tls.Conn.Read
      #3: pkg/logger/logger.go:21:15: logger.Close calls fmt.Fprintf, which calls tls.Conn.Write
      #4: internal/service/lei_service.go:321:23: service.leiService.downloadFile calls http.Get, which eventually calls tls.Dialer.DialContext

Vulnerability #6: GO-2026-4337
    Unexpected session resumption in crypto/tls
  More info: https://pkg.go.dev/vuln/GO-2026-4337
  Standard library
    Found in: crypto/tls@go1.25
    Fixed in: crypto/tls@go1.25.7
    Example traces found:
      #1: cmd/api/main.go:120:31: api.main calls http.Server.ListenAndServe, which eventually calls tls.Conn.HandshakeContext
      #2: internal/service/lei_service.go:614:27: service.leiService.extractZipFile calls io.Copy, which eventually calls tls.Conn.Read
      #3: pkg/logger/logger.go:21:15: logger.Close calls fmt.Fprintf, which calls tls.Conn.Write
      #4: internal/service/lei_service.go:321:23: service.leiService.downloadFile calls http.Get, which eventually calls tls.Dialer.DialContext

Vulnerability #7: GO-2025-4175
    Improper application of excluded DNS name constraints when verifying
    wildcard names in crypto/x509
  More info: https://pkg.go.dev/vuln/GO-2025-4175
  Standard library
    Found in: crypto/x509@go1.25
    Fixed in: crypto/x509@go1.25.5
    Example traces found:
      #1: pkg/logger/logger.go:21:15: logger.Close calls fmt.Fprintf, which eventually calls x509.Certificate.Verify

Vulnerability #8: GO-2025-4155
    Excessive resource consumption when printing error string for host
    certificate validation in crypto/x509
  More info: https://pkg.go.dev/vuln/GO-2025-4155
  Standard library
    Found in: crypto/x509@go1.25
    Fixed in: crypto/x509@go1.25.5
    Example traces found:
      #1: pkg/logger/logger.go:21:15: logger.Close calls fmt.Fprintf, which eventually calls x509.Certificate.Verify
      #2: pkg/logger/logger.go:21:15: logger.Close calls fmt.Fprintf, which eventually calls x509.Certificate.VerifyHostname

Vulnerability #9: GO-2025-4013
    Panic when validating certificates with DSA public keys in crypto/x509
  More info: https://pkg.go.dev/vuln/GO-2025-4013
  Standard library
    Found in: crypto/x509@go1.25
    Fixed in: crypto/x509@go1.25.2
    Example traces found:
      #1: pkg/logger/logger.go:21:15: logger.Close calls fmt.Fprintf, which eventually calls x509.Certificate.Verify

Vulnerability #10: GO-2025-4012
    Lack of limit when parsing cookies can cause memory exhaustion in net/http
  More info: https://pkg.go.dev/vuln/GO-2025-4012
  Standard library
    Found in: net/http@go1.25
    Fixed in: net/http@go1.25.2
    Example traces found:
      #1: internal/service/lei_service.go:321:23: service.leiService.downloadFile calls http.Get

Vulnerability #11: GO-2025-4011
    Parsing DER payload can cause memory exhaustion in encoding/asn1
  More info: https://pkg.go.dev/vuln/GO-2025-4011
  Standard library
    Found in: encoding/asn1@go1.25
    Fixed in: encoding/asn1@go1.25.2
    Example traces found:
      #1: cmd/api/main.go:127:15: api.main calls signal.Notify, which eventually calls asn1.Unmarshal

Vulnerability #12: GO-2025-4010
    Insufficient validation of bracketed IPv6 hostnames in net/url
  More info: https://pkg.go.dev/vuln/GO-2025-4010
  Standard library
    Found in: net/url@go1.25
    Fixed in: net/url@go1.25.2
    Example traces found:
      #1: internal/handler/handler.go:1251:32: handler.UserPreferenceHandler.SetPreference calls pgconn.ParseConfigError.Error, which eventually calls url.Parse
      #2: cmd/api/main.go:120:31: api.main calls http.Server.ListenAndServe, which eventually calls url.ParseRequestURI
      #3: internal/service/lei_service.go:321:23: service.leiService.downloadFile calls http.Get, which eventually calls url.URL.Parse

Vulnerability #13: GO-2025-4009
    Quadratic complexity when parsing some invalid inputs in encoding/pem
  More info: https://pkg.go.dev/vuln/GO-2025-4009
  Standard library
    Found in: encoding/pem@go1.25
    Fixed in: encoding/pem@go1.25.2
    Example traces found:
      #1: cmd/api/main.go:160:22: api.connectDatabase calls gorm.Open, which eventually calls pem.Decode

Vulnerability #14: GO-2025-4008
    ALPN negotiation error contains attacker controlled information in
    crypto/tls
  More info: https://pkg.go.dev/vuln/GO-2025-4008
  Standard library
    Found in: crypto/tls@go1.25
    Fixed in: crypto/tls@go1.25.2
    Example traces found:
      #1: cmd/api/main.go:120:31: api.main calls http.Server.ListenAndServe, which eventually calls tls.Conn.HandshakeContext
      #2: internal/service/lei_service.go:614:27: service.leiService.extractZipFile calls io.Copy, which eventually calls tls.Conn.Read
      #3: pkg/logger/logger.go:21:15: logger.Close calls fmt.Fprintf, which calls tls.Conn.Write
      #4: internal/service/lei_service.go:321:23: service.leiService.downloadFile calls http.Get, which eventually calls tls.Dialer.DialContext

Vulnerability #15: GO-2025-4007
    Quadratic complexity when checking name constraints in crypto/x509
  More info: https://pkg.go.dev/vuln/GO-2025-4007
  Standard library
    Found in: crypto/x509@go1.25
    Fixed in: crypto/x509@go1.25.3
    Example traces found:
      #1: cmd/api/main.go:127:15: api.main calls signal.Notify, which eventually calls x509.CertPool.AppendCertsFromPEM
      #2: pkg/logger/logger.go:21:15: logger.Close calls fmt.Fprintf, which eventually calls x509.Certificate.Verify
      #3: cmd/api/main.go:160:22: api.connectDatabase calls gorm.Open, which eventually calls x509.DecryptPEMBlock
      #4: cmd/api/main.go:127:15: api.main calls signal.Notify, which eventually calls x509.ParseCertificate
      #5: cmd/api/main.go:160:22: api.connectDatabase calls gorm.Open, which eventually calls x509.ParseECPrivateKey
      #6: cmd/api/main.go:160:22: api.connectDatabase calls gorm.Open, which eventually calls x509.ParsePKCS1PrivateKey
      #7: cmd/api/main.go:160:22: api.connectDatabase calls gorm.Open, which eventually calls x509.ParsePKCS8PrivateKey
      #8: cmd/api/main.go:160:22: api.connectDatabase calls gorm.Open, which eventually calls x509.SystemCertPool

Vulnerability #16: GO-2025-4006
    Excessive CPU consumption in ParseAddress in net/mail
  More info: https://pkg.go.dev/vuln/GO-2025-4006
  Standard library
    Found in: net/mail@go1.25
    Fixed in: net/mail@go1.25.2
    Example traces found:
      #1: internal/handler/handler.go:1429:28: handler.UITranslationHandler.SubmitTranslation calls gin.Context.ShouldBindJSON, which eventually calls mail.ParseAddress

Your code is affected by 16 vulnerabilities from the Go standard library.
This scan also found 3 vulnerabilities in packages you import and 1
vulnerability in modules you require, but your code doesn't appear to call these
vulnerabilities.
Use '-show verbose' for more details.
```

---

## Frontend Vulnerabilities (npm audit)

```text
found 0 vulnerabilities
```

---

## Dependabot Alerts

{"message":"Resource not accessible by integration","documentation_url":"https://docs.github.com/rest/dependabot/alerts#list-dependabot-alerts-for-a-repository","status":"403"}gh: Resource not accessible by integration (HTTP 403)

---

## Code Scanning Alerts

- [ERROR] tar: tar: File overwrite via drive-relative symlink traversal — usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/tar/package.json:1
- [ERROR] tar: tar: File overwrite via drive-relative symlink traversal — usr/local/lib/node_modules/npm/node_modules/cacache/node_modules/tar/package.json:1
- [ERROR] tar: tar: File overwrite via drive-relative symlink traversal — usr/local/lib/node_modules/npm/node_modules/tar/package.json:1
- [ERROR] node-tar: hardlink path traversal via drive-relative linkpath — usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/tar/package.json:1
- [ERROR] node-tar: hardlink path traversal via drive-relative linkpath — usr/local/lib/node_modules/npm/node_modules/cacache/node_modules/tar/package.json:1
- [ERROR] node-tar: hardlink path traversal via drive-relative linkpath — usr/local/lib/node_modules/npm/node_modules/tar/package.json:1
- [WARNING] html/template: URLs in meta content attribute actions are not escaped in html/template — usr/local/bin/migrate:1
- [NOTE] os: FileInfo can escape from a Root in golang os module — usr/local/bin/migrate:1
- [ERROR] net/url: Incorrect parsing of IPv6 host literals in net/url — usr/local/bin/migrate:1
- [WARNING] html/template: URLs in meta content attribute actions are not escaped in html/template — root/main:1
- [NOTE] os: FileInfo can escape from a Root in golang os module — root/main:1
- [ERROR] net/url: Incorrect parsing of IPv6 host literals in net/url — root/main:1
- [ERROR] minimatch: Minimatch: Denial of Service via catastrophic backtracking in glob expressions — usr/local/lib/node_modules/npm/node_modules/minimatch/package.json:1
- [ERROR] minimatch: minimatch: Denial of Service due to unbounded recursive backtracking via crafted glob patterns — usr/local/lib/node_modules/npm/node_modules/minimatch/package.json:1
- [ERROR] Database query built from user-controlled sources — backend/internal/repository/lei_repository.go:376
- [ERROR] Database query built from user-controlled sources — backend/internal/repository/lei_repository.go:279
- [ERROR] minimatch: minimatch: Denial of Service via specially crafted glob patterns — usr/local/lib/node_modules/npm/node_modules/minimatch/package.json:1
- [ERROR] tar: node-tar: node-tar: Arbitrary file read/write via malicious archive hardlink creation — usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/tar/package.json:1
- [ERROR] tar: node-tar: node-tar: Arbitrary file read/write via malicious archive hardlink creation — usr/local/lib/node_modules/npm/node_modules/cacache/node_modules/tar/package.json:1
- [ERROR] node-tar: tar: node-tar: Arbitrary file creation via path traversal bypass in hardlink security check — usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/tar/package.json:1
- [ERROR] node-tar: tar: node-tar: Arbitrary file creation via path traversal bypass in hardlink security check — usr/local/lib/node_modules/npm/node_modules/cacache/node_modules/tar/package.json:1
- [ERROR] node-tar: tar: node-tar: Arbitrary file overwrite via Unicode path collision race condition — usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/tar/package.json:1
- [ERROR] node-tar: tar: node-tar: Arbitrary file overwrite via Unicode path collision race condition — usr/local/lib/node_modules/npm/node_modules/cacache/node_modules/tar/package.json:1
- [ERROR] node-tar: tar: node-tar: Arbitrary file overwrite and symlink poisoning via unsanitized linkpaths in archives — usr/local/lib/node_modules/npm/node_modules/node-gyp/node_modules/tar/package.json:1
- [ERROR] node-tar: tar: node-tar: Arbitrary file overwrite and symlink poisoning via unsanitized linkpaths in archives — usr/local/lib/node_modules/npm/node_modules/cacache/node_modules/tar/package.json:1
- [ERROR] tar: node-tar: node-tar: Arbitrary file read/write via malicious archive hardlink creation — usr/local/lib/node_modules/npm/node_modules/tar/package.json:1
- [WARNING] During the TLS 1.3 handshake if multiple messages are sent in records  ... — root/main:1
- [ERROR] golang: archive/zip: Excessive CPU consumption when building archive index in archive/zip — root/main:1
- [ERROR] golang: net/url: Memory exhaustion in query parameter parsing in net/url — root/main:1
- [ERROR] crypto/tls: Unexpected session resumption in crypto/tls — root/main:1

---

## Action Versions in Use

The following third-party GitHub Actions are pinned in this repository:

```text
uses: DavidAnson/markdownlint-cli2-action@v18
uses: actions/cache@v4
uses: actions/checkout@v4
uses: actions/checkout@v6
uses: actions/configure-pages@v5
uses: actions/deploy-pages@v4
uses: actions/github-script@v7
uses: actions/setup-go@v5
uses: actions/setup-node@v4
uses: actions/setup-node@v6
uses: actions/upload-pages-artifact@v4
uses: aquasecurity/trivy-action@v0.35.0
uses: docker/build-push-action@v5
uses: docker/login-action@v3
uses: docker/metadata-action@v5
uses: docker/setup-buildx-action@v3
uses: github/codeql-action/upload-sarif@v4
uses: golang/govulncheck-action@v1
uses: golangci/golangci-lint-action@v8
uses: peter-evans/create-pull-request@v6
uses: softprops/action-gh-release@v2
- uses: actions/checkout@v4
```

---

*To view full details, visit:*

- *Dependabot: https://github.com/techie2000/axiom/security/dependabot*
- *Code scanning: https://github.com/techie2000/axiom/security/code-scanning*
