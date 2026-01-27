FROM golang:1.21-alpine AS builder

WORKDIR /build

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates git

# Copy canonicalizer module files
COPY canonicalizer/go.mod canonicalizer/go.sum* ./

# Copy countries module (dependency)
COPY modules/reference/countries /build/modules/reference/countries

# Download dependencies
RUN go mod download

# Copy canonicalizer source
COPY canonicalizer/ .

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build -o canonicalizer .

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /build/canonicalizer .

CMD ["/app/canonicalizer"]
