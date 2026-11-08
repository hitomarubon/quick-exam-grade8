@echo off
chcp 65001 > nul
title QuickExam - スマホ・PC起動 (QRコード表示)
cd /d "%~dp0"

if not exist "%~dp0dist\index.html" (
    echo 初回ビルドを実行しています...
    call npm.cmd run build
)

node "%~dp0server.mjs"
pause
