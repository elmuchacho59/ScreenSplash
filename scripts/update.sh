#!/bin/bash
# Script de mise à jour OTA automatique pour ScreenSplash

# Se placer à la racine du projet
cd "$(dirname "$0")/.." || exit 1

echo "🔍 Vérification des mises à jour..."
git fetch origin main

# Comparer les versions
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "NO_UPDATE_NEEDED"
    exit 0
fi

echo "🔍 Récupération des dernières mises à jour..."
git reset --hard origin/main

echo "📦 Mise à jour de l'interface..."
cd frontend
npm install --silent
npm run build --silent

echo "🔄 Déploiement des fichiers..."
rm -rf ../backend/static/*
cp -r dist/* ../backend/static/

echo "✅ Mise à jour préparée avec succès !"
