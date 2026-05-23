#!/bin/sh

# Health check script for Smart Shepherd Frontend

# Check if nginx is running
if ! pgrep nginx > /dev/null; then
    echo "Nginx is not running"
    exit 1
fi

# Check if the application is responding
if ! curl -f http://localhost:8080/health > /dev/null 2>&1; then
    echo "Health check failed"
    exit 1
fi

echo "Health check passed"
exit 0
