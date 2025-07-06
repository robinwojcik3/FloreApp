#!/usr/bin/env sh
# Installe les dépendances puis lance la suite de tests
# Utilise npm ci pour une installation reproductible

set -e

# Installation
npm ci

# Lancement des tests
npm test
