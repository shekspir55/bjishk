# Multi-stage build for minimal image size

# Stage 1: Build the Go binary
FROM golang:1.21-alpine AS builder

# Install build dependencies (CGO required for SQLite)
RUN apk add --no-cache gcc musl-dev sqlite-dev

WORKDIR /build

# Copy go mod files first for better caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary with optimizations
RUN CGO_ENABLED=1 GOOS=linux go build \
    -ldflags="-s -w -linkmode external -extldflags '-static'" \
    -a -installsuffix cgo \
    -o bjishk ./cmd/bjishk

# Stage 2: Create minimal runtime image
FROM alpine:latest

# Install ca-certificates for HTTPS and timezone data
RUN apk --no-cache add ca-certificates tzdata

# Create non-root user
RUN addgroup -g 1000 bjishk && \
    adduser -D -u 1000 -G bjishk bjishk

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/bjishk .

# Create data directory
RUN mkdir -p /app/data && chown -R bjishk:bjishk /app

# Switch to non-root user
USER bjishk

# Expose default port
EXPOSE 3015

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3015/api/health || exit 1

# Run the application
CMD ["./bjishk"]
