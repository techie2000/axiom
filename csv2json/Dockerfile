FROM golang:1.21-alpine AS builder

WORKDIR /build

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates git

# Copy go mod files from csv2json directory
COPY csv2json/go.mod csv2json/go.sum* ./
RUN go mod download

# Copy source from csv2json directory
COPY csv2json/ .

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build -o csv2json .

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /build/csv2json .

ENTRYPOINT ["/app/csv2json"]
