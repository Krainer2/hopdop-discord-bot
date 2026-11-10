@echo off
REM HOPDOP Bot - dobbeltklik for at starte.
REM Botten genstarter selv, når index.js bliver ændret.
cd /d "%~dp0"
title HOPDOP Bot
echo Starter HOPDOP Bot... (luk vinduet for at stoppe botten)
node --watch index.js
pause
