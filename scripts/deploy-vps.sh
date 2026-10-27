#!/usr/bin/env bash
set -euo pipefail

# Run yarn build + tests locally first. Only upload the generated static files.
target_host="${1:-txsh}"
deploy_dir="${2:-/home/aether/deploy/typer}"
if [[ ! "$target_host" =~ ^[a-zA-Z0-9_.@-]+$ || ! "$deploy_dir" =~ ^/[a-zA-Z0-9_./-]+$ || "$deploy_dir" == *..* ]]; then
  echo 'Invalid SSH host or deployment directory.' >&2
  exit 1
fi
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_dir"
test -s docs/index.html
test -s docs/practice-texts/44.json
release="$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD)"
archive="$(mktemp /tmp/easy-typer-release.XXXXXX.tar.gz)"
trap 'rm -f "$archive"' EXIT
tar -czf "$archive" -C docs .
archive_sha="$(sha256sum "$archive" | cut -d ' ' -f 1)"

ssh -o BatchMode=yes "$target_host" "mkdir -p '$deploy_dir/site/releases'"
scp "$archive" "$target_host:$deploy_dir/$release.tar.gz"
scp deploy/compose.yaml deploy/nginx.conf "$target_host:$deploy_dir/"
ssh -o BatchMode=yes "$target_host" bash -s -- "$deploy_dir" "$release" "$archive_sha" <<'REMOTE'
set -euo pipefail
deploy_dir="$1"
release="$2"
archive_sha="$3"
cd "$deploy_dir"
printf '%s  %s\n' "$archive_sha" "$release.tar.gz" | sha256sum -c -
mkdir "site/releases/$release"
tar -xzf "$release.tar.gz" -C "site/releases/$release"
previous="$(readlink site/current || true)"
ln -s "releases/$release" site/current.new
mv -Tf site/current.new site/current
rollback() {
  if [[ -n "$previous" ]]; then
    ln -s "$previous" site/current.rollback
    mv -Tf site/current.rollback site/current
  fi
}
if ! docker compose up -d; then
  rollback
  exit 1
fi
if ! docker compose exec -T typer nginx -t </dev/null; then
  rollback
  exit 1
fi
# Reload config on subsequent deployments; files are atomically switched above.
docker compose exec -T typer nginx -s reload </dev/null
healthy=false
for attempt in $(seq 1 15); do
  if curl --fail --silent http://127.0.0.1:18089/healthz -o /dev/null; then
    healthy=true
    break
  fi
  sleep 1
done
if [[ "$healthy" != true ]]; then
  rollback
  docker compose logs --tail 30 typer
  exit 1
fi
printf '%s\n' "$release" > current-release.txt
printf '%s\n' "$archive_sha" > current-artifact.sha256
rm "$release.tar.gz"
docker compose ps
echo "Deployed $release to http://127.0.0.1:18089"
echo "Previous release: ${previous:-none}"
REMOTE
