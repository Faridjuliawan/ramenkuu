@echo off
echo === RamenKuu - Push ke GitHub ===
echo.

cd /d "%~dp0"

git init
git add .
git commit -m "init: RamenKuu backend + frontend order & pos"
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/Faridjuliawan/ramenkuu.git
git push -u origin main

echo.
echo === Selesai! Cek repo di https://github.com/Faridjuliawan/ramenkuu ===
pause
