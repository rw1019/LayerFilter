# LayerFilter - Photoshop 图层筛选与批量选择扩展 (CEP Panel)

![Photoshop Version](https://img.shields.io/badge/Photoshop-CC2015%20--%202025+-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-lightgrey.svg)

**LayerFilter** 是一款专为 Adobe Photoshop 设计的轻量高效 CEP 扩展面板，支持根据**价格文本、文本样式特征、文字内容、图层名、图层组名**等多种规则快速筛选并批量选中目标图层。

适用于电商美工、海报排版、UI设计、多图层批量维护等高频设计场景。

---

## 🌟 核心特性

- 💰 **价格文字快速筛选**：一键筛选包含 `￥` 或 `¥` 等价格符号的文字图层。
- 🎨 **按文字样式匹配**：以当前选中的文字图层为基准，智能匹配具有相同**字体、字号、颜色、粗/斜体**的其他图层。
- 🔍 **丰富的内容匹配模式**：
  - 包含关键字
  - 前缀匹配（开头是）
  - 完全相同（精确匹配）
  - 正则表达式（高级自定义匹配）
- 📁 **图层与图层组过滤**：支持按图层名称或图层组名称进行快速过滤。
- 👁️ **隐藏图层控制**：可按需开启或关闭“包含隐藏图层”。
- 💾 **状态自动记忆**：关闭面板或重启 Photoshop 后自动保持上一次的筛选偏好。
- ⚡ **无缝嵌入**：原生深色调 UI，完美融入 Photoshop 界面，支持停靠侧边栏。

---

## 📂 项目结构

```text
LayerFilter/
├── CSXS/
│   └── manifest.xml       # CEP 扩展清单与配置
├── css/
│   └── style.css          # 面板样式表
├── icons/                 # 面板图标 (Light / Dark, 1x / 2x)
│   ├── IconDark.png
│   ├── IconDark@2X.png
│   ├── IconLight.png
│   └── IconLight@2X.png
├── js/
│   └── main.js            # 前端面板交互与状态管理
├── jsx/
│   └── host.jsx           # Photoshop ExtendScript 宿主端图层处理逻辑
├── index.html             # 面板主页面
├── 安装说明.txt            # 中文快速安装说明
├── .gitignore
└── README.md              # 项目说明文档
```

---

## 🚀 安装指南

### 方法一：手动安装（推荐）

1. **下载项目**：
   点击右上角 `Code` -> `Download ZIP` 下载并解压，确保文件夹命名为 `LayerFilter`。

2. **复制到 Photoshop 扩展目录**：
   - **Windows**：
     - 系统级目录：`C:\Program Files\Adobe\Adobe Photoshop <版本>\Required\CEP\extensions\`
     - 或用户级目录：`C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\`
   - **macOS**：
     - 用户目录：`~/Library/Application Support/Adobe/CEP/extensions/`
     - 系统目录：`/Library/Application Support/Adobe/CEP/extensions/`

3. **开启未签名扩展调试模式（如首次安装 CEP 插件）**：
   - **Windows**：
     打开注册表编辑器（`regedit`），定位至 `HKEY_CURRENT_USER\Software\Adobe\CSXS.11`（根据具体版本可能为 CSXS.9 ~ CSXS.16），新建字符串值 `PlayerDebugMode`，值设为 `1`。
   - **macOS**：
     在终端中运行：
     ```bash
     defaults write com.adobe.CSXS.11 PlayerDebugMode 1
     ```

4. **启动与使用**：
   - 重启 Adobe Photoshop。
   - 在菜单栏中打开：`窗口(Window)` -> `扩展功能(旧版) (Extensions (legacy))` -> `图层筛选`。

---

## 📖 使用说明

1. **选择依据**：
   - **价格文字**：自动提取所有包含价格符号的文本图层。
   - **与当前文字图层样式相同**：在图层面板中先选定一个基准文字图层，下方勾选需要比对的项目（字体、字号、颜色、粗体/斜体）。
   - **文字内容匹配**：在下方输入关键词并选择匹配方式（包含 / 开头是 / 完全相同 / 正则表达式）。
   - **任意图层名称包含**：搜索名称包含指定文字的所有图层。
   - **图层组名称包含**：搜索名称匹配的图层组。
2. **点击“选择匹配图层”**：插件将自动在图层面板中多选所有符合条件的图层。

---

## 🛠️ 技术栈与兼容性

- **运行环境**：Adobe Photoshop CC 2015 ~ 2025+
- **前端技术**：HTML5, CSS3, JavaScript (ES5/ES6)
- **底层脚本**：Photoshop ExtendScript (JSX) / Action Manager

---

## 📄 开源许可

本项目基于 [MIT License](LICENSE) 开源。欢迎提交 Issue 与 Pull Request！
