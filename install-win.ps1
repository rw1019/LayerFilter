[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host '  LayerFilter Photoshop 插件一键安装与配置' -ForegroundColor Cyan
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ''

# 1. 配置 CSXS 调试模式
Write-Host '[*] 正在配置 CSXS PlayerDebugMode...' -ForegroundColor Yellow
6..16 | ForEach-Object {
    $regPath = "HKCU:\Software\Adobe\CSXS.$_"
    if (-not (Test-Path $regPath)) {
        New-Item -Path $regPath -Force | Out-Null
    }
    Set-ItemProperty -Path $regPath -Name 'PlayerDebugMode' -Value '1' -Type String -Force
}
Write-Host '[+] CSXS 调试模式配置成功！' -ForegroundColor Green

# 2. 用户级 CEP 扩展目录
$appData = [System.Environment]::GetFolderPath('ApplicationData')
$targetDir = Join-Path $appData 'Adobe\CEP\extensions\LayerFilter'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }

Write-Host ''
Write-Host "[*] 目标安装路径: $targetDir" -ForegroundColor Yellow

$extDir = Join-Path $appData 'Adobe\CEP\extensions'
if (-not (Test-Path $extDir)) {
    New-Item -ItemType Directory -Path $extDir -Force | Out-Null
}

if (Test-Path $targetDir) {
    Write-Host '[*] 发现已存在旧版本，正在更新...' -ForegroundColor Yellow
    Remove-Item -Path $targetDir -Recurse -Force
}

New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

Write-Host '[*] 正在复制插件文件...' -ForegroundColor Yellow
$itemsToCopy = @('CSXS', 'css', 'icons', 'js', 'jsx', 'index.html', 'LICENSE')
foreach ($item in $itemsToCopy) {
    $src = Join-Path $scriptDir $item
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $targetDir -Recurse -Force
    }
}

Write-Host ''
Write-Host '========================================================' -ForegroundColor Green
Write-Host '  [SUCCESS] 安装完成！' -ForegroundColor Green
Write-Host ''
Write-Host '  使用说明：' -ForegroundColor White
Write-Host '  1. 请重启 Adobe Photoshop。' -ForegroundColor White
Write-Host '  2. 在顶部菜单栏打开：' -ForegroundColor White
Write-Host '     【窗口】 -> 【扩展功能(旧版)】 -> 【图层筛选】' -ForegroundColor White
Write-Host '========================================================' -ForegroundColor Green
