@echo off
chcp 65001 > nul
title QuickExam - 公開URL & QRコード表示

set "PUBLIC_URL=https://hitomarubon.github.io/quick-exam-grade8/"
set "QR_URL=https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://hitomarubon.github.io/quick-exam-grade8/"

echo =========================================================
echo   QuickExam (中2定期テスト対策 全240問) クラウド公開版
echo =========================================================
echo.
echo 【外出先でも自宅でも24時間いつでも使えるURL】
echo   %PUBLIC_URL%
echo.
echo PCブラウザでアプリとスマホ読み取り用QRコードを開いています...
echo ※ PCの電源が切れていても、スマホからいつでも開けます！
echo =========================================================

start "" "%PUBLIC_URL%"
start "" "%QR_URL%"
pause
