# Security Report

**Generated:** 2026-11-16 08:07 UTC
**Workflow run:** https://github.com/techie2000/axiom/actions/runs/43828557583

> ⚠️ This file is auto-generated. Do not edit manually.
> Trigger a new run via `gh workflow run security-report.yml` to refresh.

---

## Go Vulnerabilities (govulncheck)

```text
=== Symbol Results ===

Vulnerability #1: GO-2026-6859
    HTTP/1 server crash due to MaxBytesReader header race in net/http
  More info: https://pkg.go.dev/vuln/GO-2026-6859
  Standard library
    Found in: net/http@go1.26.10
    Fixed in: net/http@go1.26.11
    Example traces found:
      #1: pkg/logger/logger.go:21:15: logger.Close calls fmt.Fprintf, which eventually calls http.CanonicalHeaderKey
      #2: internal/service/gleif_reference_service.go:848:20: service.gleifReferenceService.get calls http.Client.Do
      #3: internal/service/lei_service.go:386:23: service.leiService.downloadFile calls http.Get
      #4: internal/handler/lei_handler.go:595:10: handler.LEIHandler.GetLevel2ProcessingFailures calls gin.Context.Header, which calls http.Header.Del
      #5: pkg/logger/logger.go:21:15: logger.Close calls fmt.Fprintf, which eventually calls http.Header.Get
      #6: internal/handler/lei_handler.go:595:10: handler.LEIHandler.GetLevel2ProcessingFailures calls gin.Context.Header, which calls http.Header.Set
      #7: internal/service/gleif_reference_service.go:838:29: service.gleifReferenceService.get calls http.NewRequest
      #8: cmd/api/main.go:153:31: api.main calls http.Server.ListenAndServe
      #9: cmd/api/main.go:169:24: api.main calls http.Server.Shutdown
      #10: internal/service/gleif_reference_service.go:1019:34: service.gleifReferenceService.fetchRegistrationAuthoritiesFromAPI calls http.body.Close
      #11: internal/service/gleif_reference_service.go:1025:35: service.gleifReferenceService.fetchRegistrationAuthoritiesFromAPI calls io.ReadAll, which calls http.body.Read
      #12: internal/service/gleif_reference_service.go:1019:34: service.gleifReferenceService.fetchRegistrationAuthoritiesFromAPI calls http.bodyEOFSignal.Close
      #13: internal/service/gleif_reference_service.go:1025:35: service.gleifReferenceService.fetchRegistrationAuthoritiesFromAPI calls io.ReadAll, which calls http.bodyEOFSignal.Read
      #14: internal/service/lei_service.go:712:27: service.leiService.extractZipFile calls io.Copy, which eventually calls http.bodyLocked.Read
      #15: internal/service/lei_service.go:712:27: service.leiService.extractZipFile calls io.Copy, which eventually calls http.bufioFlushWriter.Write
      #16: internal/service/gleif_reference_service.go:1019:34: service.gleifReferenceService.fetchRegistrationAuthoritiesFromAPI calls http.cancelTimerBody.Close
      #17: internal/service/gleif_reference_service.go:1025:35: service.gleifReferenceService.fetchRegistrationAuthoritiesFromAPI calls io.ReadAll, which calls http.cancelTimerBody.Read
      #18: pkg/logger/logger.go:21:15: logger.Close calls fmt.Fprintf, which eventually calls http.checkConnErrorWriter.Write
      #19: pkg/logger/logger.go:21:15: logger.Close calls fmt.Fprintf, which eventually calls http.chunkWriter.Write
      #20: internal/service/lei_service.go:712:27: service.leiService.extractZipFile calls io.Copy, which eventually calls http.connReader.Read
      #21: internal/service/lei_level2_service.go:1062:26: service.leiLevel2Service.processREPEXZip calls zip.checksumReader.Close, which eventually calls http.expectContinueReader.Close
      #22: internal/service/gleif_reference_service.go:1025:35: service.gleifReferenceService.fetchRegistrationAuthoritiesFromAPI calls io.ReadAll, which calls http.expectContinueReader.Read
      #23: internal/service/gleif_reference_service.go:1019:34: service.gleifReferenceService.fetchRegistrationAuthoritiesFromAPI calls http.gzipReader.Close
      #24: internal/service/gleif_reference_service.go:1025:35: service.gleifReferenceService.fetchRegistrationAuthoritiesFromAPI calls io.ReadAll, which calls http.gzipReader.Read
      #25: internal/service/lei_service.go:712:27: service.leiService.extractZipFile calls io.Copy, which eventually calls http.loggingConn.Read
      #26: pkg/logger/logger.go:21:15: logger.Close calls fmt.Fprintf, which calls http.loggingConn.Write
      #27: internal/service/lei_service.go:712:27: service.leiService.extractZipFile calls io.Copy, which eventually calls http.maxBytesReader.Read
      #28: cmd/api/main.go:160:15: api.main calls signal.Notify, which eventually calls http.onceCloseListener.Close
      #29: internal/service/lei_service.go:712:27: service.leiService.extractZipFile calls io.Copy, which eventually calls http.persistConn.Read
      #30: internal/service/lei_service.go:712:27: service.leiService.extractZipFile calls io.Copy, which eventually calls http.persistConnWriter.ReadFrom
      #31: pkg/logger/logger.go:21:15: logger.Close calls fmt.Fprintf, which eventually calls http.persistConnWriter.Write
      #32: internal/service/lei_level2_service.go:1062:26: service.leiLevel2Service.processREPEXZip calls zip.checksumReader.Close, which eventually calls http.readTrackingBody.Close
      #33: internal/service/gleif_reference_service.go:1025:35: service.gleifReferenceService.fetchRegistrationAuthoritiesFromAPI calls io.ReadAll, which calls http.readTrackingBody.Read
      #34: internal/service/gleif_reference_service.go:1025:35: service.gleifReferenceService.fetchRegistrationAuthoritiesFromAPI calls io.ReadAll, which calls http.readWriteCloserBody.Read
      #35: pkg/logger/logger.go:21:15: logger.Close calls fmt.Fprintf, which eventually calls http.response.Write
      #36: internal/handler/handler.go:1850:9: handler.UITranslationHandler.DeleteTranslation calls gin.Context.JSON, which eventually calls http.response.WriteHeader
      #37: internal/service/lei_service.go:712:27: service.leiService.extractZipFile calls io.Copy, which eventually calls http.response.WriteString
      #38: internal/handler/handler.go:1782:57: handler.UITranslationHandler.SubmitTranslation calls http.transportReadFromServerError.Error

Your code is affected by 1 vulnerability from the Go standard library.
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
  @typescript-eslint/typescript-estree  6.16.0 - 8.72.2
  Depends on vulnerable versions of minimatch
  node_modules/@typescript-eslint/typescript-estree
    @typescript-eslint/parser  6.16.0 - 8.72.2
    Depends on vulnerable versions of @typescript-eslint/typescript-estree
    node_modules/@typescript-eslint/parser
    @typescript-eslint/type-utils  6.16.0 - 8.72.2
    Depends on vulnerable versions of @typescript-eslint/typescript-estree
    Depends on vulnerable versions of @typescript-eslint/utils
    node_modules/@typescript-eslint/type-utils
      @typescript-eslint/eslint-plugin  6.16.0 - 8.72.2
      Depends on vulnerable versions of @typescript-eslint/type-utils
      Depends on vulnerable versions of @typescript-eslint/utils
      node_modules/@typescript-eslint/eslint-plugin
    @typescript-eslint/utils  6.16.0 - 8.72.2
    Depends on vulnerable versions of @typescript-eslint/typescript-estree
    node_modules/@typescript-eslint/utils

6 moderate severity vulnerabilities

To address all issues, run:
  npm audit fix
```

---

## Dependabot Alerts

{"message":"Resource not accessible by integration","documentation_url":"https://docs.github.com/rest/dependabot/alerts#list-dependabot-alerts-for-a-repository","status":"403"}gh: Resource not accessible by integration (HTTP 403)

---

## Code Scanning Alerts

- [WARNING] Improper Restriction of Operations within the Bounds of a Memory Buffe ... — library/axiom-backend:1
- [WARNING] Workflow does not contain permissions — .github/workflows/markdown-lint.yml:18
- [WARNING] undici: undici: Denial of Service via unbounded WebSocket PONG buffering — usr/local/lib/node_modules/npm/node_modules/undici/package.json:1
- [WARNING] undici: undici: Denial of Service via memory exhaustion in EventSource client — usr/local/lib/node_modules/npm/node_modules/undici/package.json:1
- [ERROR] undici: undici: Denial of Service via TLS renegotiation with mismatched certificate — usr/local/lib/node_modules/npm/node_modules/undici/package.json:1
- [ERROR] undici: undici: Denial of Service via unhandled stream error on excessive content encodings — usr/local/lib/node_modules/npm/node_modules/undici/package.json:1
- [ERROR] undici: undici: Certificate validation bypass via dropped TLS options in Agent — usr/local/lib/node_modules/npm/node_modules/undici/package.json:1
- [WARNING] minimatch: minimatch: Denial of Service via crafted glob pattern expansion — app/node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch/package.json:1
- [WARNING] minimatch: minimatch: Denial of Service via crafted glob pattern expansion — usr/local/lib/node_modules/npm/node_modules/minimatch/package.json:1
- [WARNING] glob: glob: Denial of Service (DoS) via incomplete traversal cancellation — usr/local/lib/node_modules/npm/node_modules/glob/package.json:1
- [WARNING] ip-address: ip-address: Denial of Service via excessive percent characters in IPv6 address input — usr/local/lib/node_modules/npm/node_modules/ip-address/package.json:1
- [WARNING] golang.org/x/net/html: golang.org/x/net/html: Cross-Site Scripting via improper namespace handling during HTML rendering — root/main:1
- [ERROR] golang.org/x/net/html: golang.org/x/net/html: Denial of Service via crafted HTML input — root/main:1
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
