#!/usr/bin/env bash
set -euo pipefail
artifact_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
node --check "$artifact_dir/runtime/lib/llm-router.js"
node --check "$artifact_dir/runtime/lib/spawn-agent.js"
bash -n "$artifact_dir/runtime/bin/council-driver.sh"
timeout 60 node "$artifact_dir/test/router.test.js"
timeout 30 node "$artifact_dir/tests/spawn-metadata.test.js"
timeout 30 node "$artifact_dir/tests/driver-quality.test.js"
