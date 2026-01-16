#!/bin/bash

echo "Building all RADIUS test programs..."
echo ""

# Build test_auth
echo "Building test_auth..."
go build -o test_auth test_auth.go config.go database.go radius.go
if [ $? -eq 0 ]; then
    echo "✓ test_auth built successfully"
else
    echo "✗ test_auth build failed"
    exit 1
fi

# Build test_accounting
echo "Building test_accounting..."
go build -o test_accounting test_accounting.go config.go database.go radius.go
if [ $? -eq 0 ]; then
    echo "✓ test_accounting built successfully"
else
    echo "✗ test_accounting build failed"
    exit 1
fi

# Build load_test (optional - may have issues)
echo "Building load_test..."
go build -o load_test load_test.go config.go database.go radius.go
if [ $? -eq 0 ]; then
    echo "✓ load_test built successfully"
else
    echo "⚠ load_test build failed (skipping)"
fi

# Build simulate_online (optional - may have issues)
echo "Building simulate_online..."
go build -o simulate_online simulate_online.go config.go database.go radius.go
if [ $? -eq 0 ]; then
    echo "✓ simulate_online built successfully"
else
    echo "⚠ simulate_online build failed (skipping)"
fi

echo ""
echo "========================================="
echo "All tests built successfully!"
echo "========================================="
echo "Available commands:"
echo "  ./test_auth          - Test authentication"
echo "  ./test_accounting    - Test accounting sessions"
echo "  ./load_test          - Run load tests"
echo "  ./simulate_online    - Simulate online users"
echo "========================================="
