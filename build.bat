@echo off
chcp 65001 >nul
echo ===========================================
echo   jsonExcel 打包脚本
echo ===========================================
echo.

where conda >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到Anaconda/Miniconda
    pause
    exit /b 1
)

echo [1/4] 正在激活conda环境...
call conda activate json-to-excel
if %errorlevel% neq 0 (
    echo [错误] 环境不存在，请先创建环境
    pause
    exit /b 1
)

echo [2/4] 清理旧构建文件...
if exist build\dist rmdir /s /q build\dist
if exist build\build rmdir /s /q build\build
if exist build\__pycache__ rmdir /s /q build\__pycache__

echo [3/4] 正在打包程序（这可能需要几分钟）...
cd build
pyinstaller build.spec --clean --noconfirm
if %errorlevel% neq 0 (
    echo [错误] 打包失败
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo ===========================================
echo   打包完成！
echo ===========================================
echo 可执行文件位置: build\dist\JExcel.exe
echo.
pause
