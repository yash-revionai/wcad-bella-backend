#!/bin/bash
set -e

if [ -d admin ]; then
  cd admin
  npm run build
  cp .next/routes-manifest.json .next/routes-manifest-deterministic.json
  cd ..
  rm -rf .next
  cp -R admin/.next .next
else
  npm run build
  cp .next/routes-manifest.json .next/routes-manifest-deterministic.json
fi
