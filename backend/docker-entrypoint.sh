#!/bin/sh
# Migrate, seed (unless SEED_ON_START=false), then exec the API so it gets signals.
set -eu

node dist/database/run-migrations.js

if [ "${SEED_ON_START:-true}" = "true" ]; then
  node dist/database/seed/run-seed.js
fi

exec node dist/main.js
