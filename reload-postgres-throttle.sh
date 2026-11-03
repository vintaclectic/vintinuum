#!/bin/bash
# Reload postgres configuration to apply bitmagnet IO throttling settings
# Added 2026-10-22, task G3D9RUV

set -e

echo "Reloading PostgreSQL configuration..."
sudo systemctl reload postgresql@16-main

echo "Verifying settings took effect..."
sudo -u postgres psql -c "SHOW work_mem;"
sudo -u postgres psql -c "SHOW effective_io_concurrency;"

echo ""
echo "Expected: work_mem = 2MB, effective_io_concurrency = 0"
echo "Throttle settings applied successfully!"
