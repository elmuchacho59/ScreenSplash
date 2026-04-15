#!/bin/bash
# Script de mise à jour OTA automatique pour ScreenSplash

# Se placer à la racine du projet
cd "$(dirname "$0")/.." || exit 1

echo "🔍 Récupération des dernières mises à jour..."
git fetch origin main
git rebase origin/main

echo "📦 Mise à jour de l'interface..."
cd frontend
npm install --silent
npm run build --silent

echo "🔄 Déploiement des fichiers..."
rm -rf ../backend/static/*
cp -r dist/* ../backend/static/

echo "✅ Mise à jour préparée avec succès !"
