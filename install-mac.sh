#!/bin/bash
set -e

echo "========================================================"
echo "  LayerFilter Photoshop 插件 macOS 一键安装脚本"
echo "========================================================"
echo ""

# 1. 配置 PlayerDebugMode (CSXS 6 到 16)
echo "[*] 正在配置 CSXS PlayerDebugMode..."
for version in {6..16}; do
    defaults write "com.adobe.CSXS.${version}" PlayerDebugMode 1 2>/dev/null || true
done
echo "[+] PlayerDebugMode 配置完成！"

# 2. 用户级 CEP 扩展目录
TARGET_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions/LayerFilter"
echo ""
echo "[*] 目标安装路径: $TARGET_DIR"

mkdir -p "$HOME/Library/Application Support/Adobe/CEP/extensions"
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[*] 正在复制插件文件..."
cp -R "$SCRIPT_DIR/CSXS" "$TARGET_DIR/"
cp -R "$SCRIPT_DIR/css" "$TARGET_DIR/"
cp -R "$SCRIPT_DIR/icons" "$TARGET_DIR/"
cp -R "$SCRIPT_DIR/js" "$TARGET_DIR/"
cp -R "$SCRIPT_DIR/jsx" "$TARGET_DIR/"
cp "$SCRIPT_DIR/index.html" "$TARGET_DIR/"
cp "$SCRIPT_DIR/LICENSE" "$TARGET_DIR/" 2>/dev/null || true

echo ""
echo "========================================================"
echo "  [SUCCESS] 安装完成！"
echo ""
echo "  使用说明："
echo "  1. 请重启 Adobe Photoshop。"
echo "  2. 在菜单栏打开：【窗口】 -> 【扩展功能(旧版)】 -> 【图层筛选】"
echo "========================================================"
