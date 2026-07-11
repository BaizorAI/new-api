@echo off
REM dev.cmd — 本地开发环境快速启动（无缓存）
cd /d C:\Users\Lucky\baizor\baizor-new-api\web\default

echo [1/3] 清除 dist + .cache ...
rmdir /s /q dist 2>nul
rmdir /s /q node_modules\.cache 2>nul

echo [2/3] 清理缓存后启动 bun run dev ...
bun run dev
