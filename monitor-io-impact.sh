#!/bin/bash
# Monitor IO impact of bitmagnet throttling
# Added 2026-10-22, task G3D9RUV

echo "=== IO Pressure Monitor ==="
echo "Monitoring /dev/sdd IO and pressure for 60 seconds..."
echo ""

# Get initial stats
io_start=$(cat /proc/pressure/io)
sdd_sectors_start=$(awk '/sdd / {print $3}' /proc/diskstats)

echo "Initial IO pressure:"
echo "$io_start"
echo ""

echo "Waiting 60 seconds..."
sleep 60

# Get final stats
io_end=$(cat /proc/pressure/io)
sdd_sectors_end=$(awk '/sdd / {print $3}' /proc/diskstats)

echo "Final IO pressure:"
echo "$io_end"
echo ""

# Calculate sdd read delta
sectors_read=$((sdd_sectors_end - sdd_sectors_start))
mb_read=$((sectors_read * 512 / 1024 / 1024))

echo "=== Results ==="
echo "Sectors read from /dev/sdd in 60s: $sectors_read"
echo "Data read from /dev/sdd in 60s: ${mb_read} MB"
echo ""
echo "Active postgres connections to bitmagnet:"
ps aux | grep -c 'postgres.*bitmagnet' || echo "0"
echo ""
echo "Postgres backends in D state:"
ps aux | grep 'postgres.*bitmagnet' | awk '$8 ~ /D/ {print $0}' | wc -l
