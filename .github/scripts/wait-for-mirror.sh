#!/usr/bin/env bash
# Wait until every ${DOCKER_LIBRARY} base image used by the given Dockerfiles exists in
# the GHCR mirror (populated by mirror-base-images.yml).
#
# Usage: wait-for-mirror.sh <mirror-registry-path> <Dockerfile>...
# Env:   WAIT_TIMEOUT  seconds to wait for all images (default 900)
set -euo pipefail

mirror="${1:?usage: wait-for-mirror.sh <mirror-registry-path> <Dockerfile>...}"
shift
timeout_s="${WAIT_TIMEOUT:-900}"
deadline=$((SECONDS + timeout_s))

images=$(grep -hoE '^FROM \$\{DOCKER_LIBRARY\}/[^ ]+' "$@" | sed 's#.*}/##' | sort -u)
if [ -z "${images}" ]; then
  echo "No \${DOCKER_LIBRARY} base images found in: $*" >&2
  exit 1
fi

for image in ${images}; do
  until docker buildx imagetools inspect "${mirror}/${image}" >/dev/null 2>&1; do
    if [ "${SECONDS}" -ge "${deadline}" ]; then
      echo "::error::${mirror}/${image} not found after ${timeout_s}s. Check the Mirror Base Images workflow and its matrix."
      exit 1
    fi
    echo "Waiting for ${mirror}/${image} ..."
    sleep 20
  done
  echo "Found ${mirror}/${image}"
done
