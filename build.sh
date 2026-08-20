#!/usr/bin/env bash
# exit on error
set -o errexit

echo "===> Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "===> Building Frontend..."
cd frontend
npm install
npm run build
cd ..

echo "===> Build completed successfully!"
