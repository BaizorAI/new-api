@echo off
cd /d C:\Users\Lucky\baizor\baizor-new-api\web\default
rmdir /s /q dist 2>nul
rmdir /s /q node_modules\.cache 2>nul
bun run build
bun run dev
