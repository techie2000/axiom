FROM golang:1.21-alpine AS builder

WORKDIR /build

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates git

# Copy go mod files from csv2json directory
COPY csv2json/go.mod csv2json/go.sum* ./

# Bypass Go module proxy for corporate environments with TLS-inspecting proxies
# GOPROXY=direct fetches modules directly from source repositories
# GOINSECURE=* skips HTTPS verification for all domains (dev only!)
# For production, add your corporate CA certificate to the image instead
ENV GOPROXY=direct
ENV GOSUMDB=off
ENV GOINSECURE="*"
RUN git config --global http.sslVerify false
# Download dependencies
RUN go mod download
RUN go mod tidy

# Copy source from csv2json directory
COPY csv2json/ .

# Build binary (keep env vars for any missing modules)
RUN CGO_ENABLED=0 GOOS=linux go build -mod=mod -o csv2json .

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /build/csv2json .

ENTRYPOINT ["/app/csv2json"]
