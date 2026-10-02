#!/bin/sh
# Generates the database password and the API's JWT key on first start, into the
# shared `secrets` volume (mounted read-only by the backend). Values set in .env win.
set -eu

dir=/run/secrets

generate() {
  if [ ! -s "$dir/$1" ]; then
    # 32 random bytes as hex. Write then rename so a file is never half written.
    od -An -tx1 -N32 /dev/urandom | tr -d ' \n' > "$dir/.$1.tmp"
    chmod 0444 "$dir/.$1.tmp"
    mv "$dir/.$1.tmp" "$dir/$1"
  fi
}

generate postgres_password
generate jwt_secret

# The postgres entrypoint reads POSTGRES_PASSWORD_FILE when POSTGRES_PASSWORD is empty.
if [ -z "${POSTGRES_PASSWORD:-}" ]; then
  export POSTGRES_PASSWORD_FILE="$dir/postgres_password"
fi

# Postgres reads the password only when it creates the database. On later starts set it
# again, so a password added to or changed in .env still matches the one the API uses.
# The server listens on its socket only meanwhile, so nothing connects with the old one.
if [ -s "$PGDATA/PG_VERSION" ]; then
  DB_PASSWORD="${POSTGRES_PASSWORD:-$(cat "$dir/postgres_password")}"
  DB_USER="${POSTGRES_USER:-postgres}"
  export DB_PASSWORD DB_USER
  gosu postgres pg_ctl -D "$PGDATA" -o "-c listen_addresses=''" -w start > /dev/null
  gosu postgres psql -q -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname postgres <<'SQL'
\getenv user DB_USER
\getenv password DB_PASSWORD
ALTER ROLE :"user" PASSWORD :'password';
SQL
  gosu postgres pg_ctl -D "$PGDATA" -m fast -w stop > /dev/null
  unset DB_PASSWORD
fi

exec docker-entrypoint.sh "$@"
