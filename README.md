# LayerFilter - Photoshop 高性能图层筛选与批量批处理扩展 (CEP Panel)

![Photoshop Version](https://img.shields.io/badge/Photoshop-CC2015%20--%202026+-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-lightgrey.svg)

**LayerFilter** 是一款专为 Adobe Photoshop 打造的轻量、高效、全能型 CEP 扩展面板。采用底层 **Action Manager** 级极速图层扫描引擎，支持根据**价格文本、文字样式特征、文字内容、图层名、图层组名、图层类型**等多种维度快速筛选，并提供**批量选中、显示、隐藏、锁定与一键编组**等高效批处理工具。

适用于电商美工、海报排版、UI设计、多图层批量维护等高频设计场景。

---

## 🌟 核心特性与优化升级

- ⚡ **底层性能大幅跃升**：全面重构为 Photoshop Action Manager 底层索引扫描，数千图层大型 PSD 秒级响应，彻底告别传统 DOM 递归遍历的卡顿与假死。
- 💰 **价格文字智能筛选**：
  - 自动识别国内外电商价格常见符号（`￥`, `¥`, `$`, `€`, `£`, `HK$`, `NT$`, `RMB`）。
  - 支持营销价格关键词（`券后`、`到手价`、`特价`、`现价`、`原价` 等）。
  - 允许在输入框中自定义特殊价格符号或关键词。
- 🎯 **图层类型全能筛选 (New)**：
  - 支持一键快速提取：**纯文字图层 (Text)**、**智能对象 (SmartObject)**、**矢量/形状图层 (Shape)**、**普通像素图层 (Pixel)**、**调整图层 (Adjustment)** 以及 **图层组 (Group)**。
- 🎨 **样式匹配容错增强**：
  - 以当前选中文本图层为基准，智能匹配相同**字体、字号、颜色、粗/斜体**。
  - 内置浮点字号与 RGB 色彩容差计算，全面兼容多字体/多字号混排文本及非 RGB 色彩空间。
- 🔍 **丰富的内容匹配模式与大小写控制**：
  - 支持包含、前缀匹配、完全相同、正则表达式。
  - 增加 **【忽略大小写】** 开关，检索更加人性化。
- 🛠️ **快捷批处理动作栏 (New)**：
  - 除了“选择图层”外，新增 **【显示】**、**【隐藏】**、**【锁定】**、**【一键编组】** 批处理按钮。
- ⌨️ **回车即搜 (Enter 快捷键)**：输入关键词后直接按下回车键即可执行筛选。
- 🌓 **Photoshop 4套界面主题自适应 (New)**：
  - 自动同步 Photoshop 首选项面板色彩（深黑、深灰、中灰、浅白），呈现原生界面质感。
- 💾 **设置状态记忆**：记住上一次的使用偏好。

---

## 📂 项目结构

```text
LayerFilter/
├── CSXS/
│   └── manifest.xml       # CEP 扩展清单与配置
├── css/
│   └── style.css          # 面板自适应样式表
├── icons/                 # 面板图标 (Light / Dark, 1x / 2x)
│   ├── IconDark.png
│   ├── IconDark@2X.png
│   ├── IconLight.png
│   └── IconLight@2X.png
├── js/
│   └── main.js            # 前端面板交互、主题同步与批处理逻辑
├── jsx/
│   └── host.jsx           # Photoshop ExtendScript 高性能 Action Manager 扫描内核
├── index.html             # 面板主页面
├── install-win.bat        # Windows 一键安装与调试配置脚本
├── install-mac.sh         # macOS 一键安装脚本
├── 安装说明.txt            # 中文快速安装指南
├── .gitignore
└── README.md              # 项目说明文档
```

---

## 🚀 极速安装指南

### 方法一：一键自动安装（推荐）

* **Windows 用户**：
  1. 下载解压本项目；
  2. 双击运行根目录下的 `install-win.bat`；
  3. 重启 Photoshop 即可。
  *(脚本会自动开启 CSXS 调试模式并复制至用户级 CEP 目录，无需管理员权限)*

* **macOS 用户**：
  1. 打开终端（Terminal）进入本项目所在文件夹；
  2. 运行命令：`bash install-mac.sh`；
  3. 重启 Photoshop 即可。

---

### 方法二：手动安装

1. **复制文件夹**：
   将 `LayerFilter` 文件夹复制到用户 CEP 插件目录：
   - **Windows**：`%APPDATA%\Adobe\CEP\extensions\LayerFilter`
     *(即 `C:\Users\<用户名>\AppData\Roaming\Adobe\CEP\extensions\LayerFilter`)*
   - **macOS**：`~/Library/Application Support/Adobe/CEP/extensions/LayerFilter`

2. **开启未签名扩展调试模式**：
   - **Windows**：
     打开注册表（`regedit`），定位至 `HKEY_CURRENT_USER\Software\Adobe\CSXS.11`（建议 9~16 均添加），新建字符串值 `PlayerDebugMode`，值设为 `1`。
   - **macOS**：
     在终端运行：
     ```bash
     defaults write com.adobe.CSXS.11 PlayerDebugMode 1
     ```

3. **打开使用**：
   - 重启 Adobe Photoshop。
   - 顶部菜单：`窗口(Window)` -> `扩展功能(旧版) (Extensions (legacy))` -> `图层筛选`。

---

## 📖 使用说明

1. **选择依据**：
   - **价格文字**：快速匹配含国内外价格符号及电商文案的图层。
   - **与当前文字图层样式相同**：在图层面板中先选定一个基准文字图层，下方勾选需要比对的项目。
   - **文字内容匹配**：输入关键词并选择匹配方式。
   - **图层名称 / 图层组名称**：按图层或组名称检索。
   - **按图层类型筛选**：直接筛选智能对象、形状、文字、像素、调整层或组。
2. **执行操作**：
   - 点击 **“选择匹配图层”** 或直接按键盘 **Enter**。
   - 亦可直接点击下方快捷按钮完成 **批量显示 / 隐藏 / 锁定 / 一键编组**。

---

## 🛠️ 技术栈与兼容性

- **运行环境**：Adobe Photoshop CC 2015 ~ 2026+
- **前端技术**：HTML5, CSS3 Variables, ES5/ES6, CEP Event Bridge
- **底层脚本**：Photoshop ExtendScript (JSX) / Action Manager Engine (AM)

---

## 📄 开源许可

本项目基于 [MIT License](LICENSE) 开源。
