#!/bin/bash
set -e

echo "=== 🚀 Starting Monorepo Unified Build for Vercel ==="

# 1. 아웃풋 디렉토리 초기화
rm -rf dist
mkdir -p dist

# 2. Book 앱 (관문 & 스케줄러) 빌드
echo "=== 📚 Building Book App (Main Portal) ==="
cd book
npm install
npm run build
cp -R dist/* ../dist/
cd ..

# 3. Dashboard 앱 (물리치료실 상황판) 빌드
echo "=== 🛏️ Building Dashboard App ==="
cd dashboard
npm install
npm run build
mkdir -p ../dist/dashboard
cp -R dist/* ../dist/dashboard/
cd ..

echo "=== ✅ Unified Build Completed Successfully! ==="
