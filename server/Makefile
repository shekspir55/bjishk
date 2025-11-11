.PHONY: build run clean dev release

# Development build (with debug symbols)
build:
	go build -o bjishk ./cmd/bjishk

# Production build (optimized, stripped)
release:
	go build -ldflags="-s -w" -trimpath -o bjishk ./cmd/bjishk
	@echo "Binary size: $$(du -h bjishk | cut -f1)"

# Ultra-compressed build with UPX
release-compressed: release
	upx --best --lzma bjishk 2>/dev/null || echo "UPX not installed, skipping compression"
	@echo "Compressed size: $$(du -h bjishk | cut -f1)"

run: build
	./bjishk

dev:
	go run ./cmd/bjishk

clean:
	rm -f bjishk bjishk-old

install: release
	sudo cp bjishk /usr/local/bin/

test:
	go test ./...
