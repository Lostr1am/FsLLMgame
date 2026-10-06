@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 巅峰回廊 APEX CORRIDOR - 本地启动

echo ============================================
echo   巅峰回廊 APEX CORRIDOR - 本地启动
echo ============================================
echo.

set PYCMD=
rem 真跑一次 python 探活（Windows 自带的 python.exe 可能只是应用商店占位符）
python -c "print(1)" >nul 2>nul
if not errorlevel 1 set PYCMD=python
if "%PYCMD%"=="" (
  py -3 -c "print(1)" >nul 2>nul
  if not errorlevel 1 set PYCMD=py -3
)

if not "%PYCMD%"=="" goto serve

echo [提示] 这台电脑没有可用的 Python，改用「直接打开网页」方式启动。
echo.
echo   1) 建议用 Chrome 或 Edge 打开
echo   2) 这种方式下存档(localStorage)可能不稳定
echo   3) 想要更稳的存档，可安装 Python 后重新运行本脚本
echo.
start "" "index.html"
echo 已尝试打开 index.html。若没反应，请手动双击本文件夹里的 index.html。
pause
exit /b

:serve
echo 使用命令：%PYCMD%
echo 正在启动本地服务器 http://localhost:8080 ...
echo 会另开一个窗口跑服务器，关闭那个窗口即停止；本窗口可直接关闭。
echo.
start "APEX 本地服务器 (关闭此窗口=停止)" cmd /c "%PYCMD% -m http.server 8080 & echo. & echo 服务器已停止，按任意键关闭。 & pause"
timeout /t 2 >nul
start "" http://localhost:8080
exit /b
