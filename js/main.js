(function () {
    "use strict";

    var storageKey = "layerFilterSettingsV2";
    var defaults = {
        mode: "price",
        query: "",
        matchKind: 0,
        includeHidden: false,
        ignoreCase: true,
        layerType: "text",
        matchFont: true,
        matchSize: true,
        matchColor: true,
        matchFace: true
    };

    var isBusy = false; // Concurrency guard to prevent parallel runs and UI flicker

    // DOM Elements
    var queryInput = document.getElementById("query");
    var matchKind = document.getElementById("match-kind");
    var includeHidden = document.getElementById("include-hidden");
    var ignoreCase = document.getElementById("ignore-case");
    var layerTypeGrid = document.getElementById("layer-type-grid");
    var typeChips = document.querySelectorAll(".type-chip");
    var queryRow = document.getElementById("query-row");
    var matchFont = document.getElementById("match-font");
    var matchSize = document.getElementById("match-size");
    var matchColor = document.getElementById("match-color");
    var matchFace = document.getElementById("match-face");
    var styleOptions = document.getElementById("style-options");
    var selectButton = document.getElementById("select-layers");
    var btnShow = document.getElementById("btn-show");
    var btnHide = document.getElementById("btn-hide");
    var btnLock = document.getElementById("btn-lock");
    var btnGroup = document.getElementById("btn-group");
    var btnCopyStyle = document.getElementById("btn-copy-style");
    var btnPasteStyle = document.getElementById("btn-paste-style");
    var btnPickName = document.getElementById("btn-pick-name");
    var status = document.getElementById("status");
    var modeInputs = document.querySelectorAll('input[name="mode"]');

    var allActionButtons = [
        selectButton, btnShow, btnHide, btnLock, btnGroup,
        btnCopyStyle, btnPasteStyle, btnPickName
    ];

    initThemeSync();
    restoreSettings();
    updateControls();

    // Mode radio change listeners
    for (var i = 0; i < modeInputs.length; i++) {
        modeInputs[i].addEventListener("change", function () {
            updateControls();
            saveSettings();
        });
    }

    // Direct Type Chip click handlers (with deduplication and debounce guard)
    for (var c = 0; c < typeChips.length; c++) {
        typeChips[c].addEventListener("click", function () {
            if (isBusy) return;

            var selectedType = this.getAttribute("data-type");
            var currentActiveType = getSelectedLayerType();
            var mode = currentMode();

            // 若当前已是图层类型模式且点击的是同一个类型，避免重复触发整档全搜
            if (mode === "type" && currentActiveType === selectedType) {
                return;
            }

            setSelectedLayerType(selectedType);

            // 自动选中“按图层类型筛选”单选框
            var typeRadio = document.querySelector('input[name="mode"][value="type"]');
            if (typeRadio) {
                typeRadio.checked = true;
            }

            updateControls();
            saveSettings();

            // 仅限“按图层类型筛选”：点击类型按钮后，免按确认键，立即自动触发筛选
            executeAction("select");
        });
    }

    // Controls change listeners
    var persistentControls = [
        queryInput, matchKind, includeHidden, ignoreCase,
        matchFont, matchSize, matchColor, matchFace
    ];
    for (var j = 0; j < persistentControls.length; j++) {
        persistentControls[j].addEventListener("change", saveSettings);
    }
    queryInput.addEventListener("input", saveSettings);

    // Keyboard Enter trigger (with concurrency protection)
    queryInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.keyCode === 13) {
            e.preventDefault();
            if (!isBusy) {
                executeAction("select");
            }
        }
    });

    // Action button clicks
    selectButton.addEventListener("click", function () { executeAction("select"); });
    btnShow.addEventListener("click", function () { executeAction("show"); });
    btnHide.addEventListener("click", function () { executeAction("hide"); });
    btnLock.addEventListener("click", function () { executeAction("lock"); });
    btnGroup.addEventListener("click", function () { executeAction("group"); });

    // Deduplicated runner for simple JSX functions (Copy / Paste style)
    function runSimpleAction(jsxCode, loadingText) {
        if (isBusy) return;

        if (typeof window.__adobe_cep__ === "undefined" || !window.__adobe_cep__.evalScript) {
            showStatus("离线测试模式。", false, true);
            return;
        }

        isBusy = true;
        setButtonsDisabled(true);
        showStatus(loadingText, false);

        window.__adobe_cep__.evalScript(jsxCode, function (result) {
            isBusy = false;
            setButtonsDisabled(false);
            if (!result || result === "EvalScript error.") {
                showStatus("Photoshop 执行失败或脚本异常。", true);
                return;
            }
            if (result.indexOf("OK|") === 0) {
                showStatus(result.substring(3), false, true);
            } else if (result.indexOf("ERR|") === 0) {
                showStatus(result.substring(4), true);
            } else {
                showStatus(result, true);
            }
        });
    }

    btnCopyStyle.addEventListener("click", function () {
        runSimpleAction("LayerFilter.copyLayerStyle()", "正在复制图层样式...");
    });

    btnPasteStyle.addEventListener("click", function () {
        runSimpleAction("LayerFilter.pasteLayerStyle()", "正在粘贴图层样式...");
    });

    // Pick active layer name and fill into query
    btnPickName.addEventListener("click", function () {
        if (isBusy) return;

        if (typeof window.__adobe_cep__ === "undefined" || !window.__adobe_cep__.evalScript) {
            queryInput.value = "测试图层名称";
            saveSettings();
            showStatus("离线模式：已填入测试图层名", false, true);
            return;
        }

        isBusy = true;
        showStatus("正在获取当前图层名称...", false);
        window.__adobe_cep__.evalScript("LayerFilter.getActiveLayerName()", function (result) {
            isBusy = false;
            if (!result || result === "EvalScript error.") {
                showStatus("Photoshop 未能返回当前图层名称。", true);
                return;
            }
            if (result.indexOf("OK|") === 0) {
                var layerName = result.substring(3);
                queryInput.value = layerName;

                // 若当前模式无法输入关键词，自动切换为“图层名称匹配”
                var mode = currentMode();
                if (mode === "type" || mode === "style") {
                    var nameRadio = document.querySelector('input[name="mode"][value="name"]');
                    if (nameRadio) {
                        nameRadio.checked = true;
                        updateControls();
                    }
                }

                saveSettings();
                showStatus("已填入图层名称: " + layerName, false, true);

                // 失焦跳出文本输入框，将键盘焦点释放还给 Photoshop，避免快捷键被捕获到输入框中
                queryInput.blur();
                btnPickName.blur();
                if (document.activeElement && typeof document.activeElement.blur === "function") {
                    document.activeElement.blur();
                }
                if (typeof window.blur === "function") {
                    window.blur();
                }
            } else if (result.indexOf("ERR|") === 0) {
                showStatus(result.substring(4), true);
            } else {
                showStatus(result, true);
            }
        });
    });

    function currentMode() {
        var checked = document.querySelector('input[name="mode"]:checked');
        return checked ? checked.value : "price";
    }

    function getSelectedLayerType() {
        var active = document.querySelector(".type-chip.active");
        return active ? active.getAttribute("data-type") : "text";
    }

    function setSelectedLayerType(type) {
        for (var i = 0; i < typeChips.length; i++) {
            if (typeChips[i].getAttribute("data-type") === type) {
                typeChips[i].classList.add("active");
            } else {
                typeChips[i].classList.remove("active");
            }
        }
    }

    function updateControls() {
        var mode = currentMode();

        // Layer type chip grid visibility
        if (mode === "type") {
            layerTypeGrid.classList.remove("hidden");
        } else {
            layerTypeGrid.classList.add("hidden");
        }

        // Query input availability
        var needsQuery = mode === "content" || mode === "name" || mode === "group";
        var allowsQuery = needsQuery || mode === "price";
        queryInput.disabled = !allowsQuery;
        if (mode === "price") {
            queryInput.placeholder = "可选：输入自定义符号或关键词";
        } else if (mode === "type") {
            queryInput.placeholder = "按类型筛选无需关键词";
        } else {
            queryInput.placeholder = "输入搜索关键词...";
        }

        matchKind.disabled = !(mode === "content" || mode === "name" || mode === "group");
        styleOptions.disabled = mode !== "style";
    }

    function readSettings() {
        return {
            mode: currentMode(),
            query: queryInput.value,
            matchKind: Number(matchKind.value),
            includeHidden: includeHidden.checked,
            ignoreCase: ignoreCase.checked,
            layerType: getSelectedLayerType(),
            matchFont: matchFont.checked,
            matchSize: matchSize.checked,
            matchColor: matchColor.checked,
            matchFace: matchFace.checked
        };
    }

    function saveSettings() {
        try {
            localStorage.setItem(storageKey, JSON.stringify(readSettings()));
        } catch (error) {}
    }

    function restoreSettings() {
        var settings = defaults;
        try {
            var saved = JSON.parse(localStorage.getItem(storageKey) || "null");
            if (saved) {
                settings = merge(defaults, saved);
            }
        } catch (error) {
            settings = defaults;
        }

        var selectedMode = document.querySelector('input[name="mode"][value="' + settings.mode + '"]');
        (selectedMode || modeInputs[0]).checked = true;
        queryInput.value = settings.query;
        matchKind.value = String(settings.matchKind);
        includeHidden.checked = settings.includeHidden;
        ignoreCase.checked = settings.ignoreCase !== undefined ? settings.ignoreCase : true;
        setSelectedLayerType(settings.layerType || "text");
        matchFont.checked = settings.matchFont;
        matchSize.checked = settings.matchSize;
        matchColor.checked = settings.matchColor;
        matchFace.checked = settings.matchFace;
    }

    function setButtonsDisabled(disabled) {
        for (var k = 0; k < allActionButtons.length; k++) {
            if (allActionButtons[k]) {
                allActionButtons[k].disabled = disabled;
            }
        }
    }

    function executeAction(actionType) {
        if (isBusy) return;

        var settings = readSettings();

        // Validation
        var needsQuery = settings.mode === "content" || settings.mode === "name" || settings.mode === "group";
        if (needsQuery && !settings.query.replace(/^\s+|\s+$/g, "")) {
            showStatus("请输入搜索关键词。", true);
            queryInput.focus();
            return;
        }

        if (settings.mode === "style" && !settings.matchFont && !settings.matchSize &&
            !settings.matchColor && !settings.matchFace) {
            showStatus("请至少勾选一个样式匹配项目。", true);
            return;
        }

        // Consistent Regex validation with ignoreCase flag
        if ((settings.mode === "content" || settings.mode === "name" || settings.mode === "group") && settings.matchKind === 3) {
            try {
                var flags = settings.ignoreCase ? "i" : "";
                new RegExp(settings.query, flags);
            } catch (error) {
                showStatus("正则表达式语法无效。", true);
                return;
            }
        }

        saveSettings();
        isBusy = true;
        setButtonsDisabled(true);
        showStatus("正在筛选与处理...", false);

        if (typeof window.__adobe_cep__ === "undefined" || !window.__adobe_cep__.evalScript) {
            isBusy = false;
            setButtonsDisabled(false);
            showStatus("当前处于离线测试模式 (非 CEP 环境)。", false);
            return;
        }

        var script = "LayerFilter.runAction(" + [
            quote(actionType),
            quote(settings.mode),
            quote(settings.query),
            settings.matchKind,
            settings.includeHidden,
            settings.ignoreCase,
            quote(settings.layerType),
            settings.matchFont,
            settings.matchSize,
            settings.matchColor,
            settings.matchFace
        ].join(",") + ")";

        window.__adobe_cep__.evalScript(script, function (result) {
            isBusy = false;
            setButtonsDisabled(false);
            if (!result || result === "EvalScript error.") {
                showStatus("Photoshop 执行失败或脚本异常。", true);
                return;
            }

            if (result.indexOf("OK|") === 0) {
                var parts = result.split("|");
                var count = parts[1] || "0";
                var elapsed = parts[2] ? " (" + parts[2] + "ms)" : "";
                var actionText = parts[3] || "已选中";
                showStatus(actionText + " " + count + " 个图层" + elapsed, false, true);
            } else if (result.indexOf("ERR|") === 0) {
                showStatus(result.substring(4), true);
            } else {
                showStatus(result, true);
            }
        });
    }

    function quote(value) {
        return JSON.stringify(String(value));
    }

    function showStatus(message, isError, isSuccess) {
        status.textContent = message;
        status.className = "status" + (isError ? " error" : (isSuccess ? " success" : ""));
    }

    function merge(base, extra) {
        var result = {};
        var key;
        for (key in base) {
            if (base.hasOwnProperty(key)) {
                result[key] = base[key];
            }
        }
        for (key in extra) {
            if (extra.hasOwnProperty(key) && base.hasOwnProperty(key)) {
                result[key] = extra[key];
            }
        }
        return result;
    }

    // Adaptive Photoshop UI Skin Theme
    function initThemeSync() {
        if (typeof window.__adobe_cep__ === "undefined") return;

        function applySkinInfo() {
            try {
                var hostEnv = JSON.parse(window.__adobe_cep__.getHostEnvironment());
                if (!hostEnv || !hostEnv.appSkinInfo) return;
                var skin = hostEnv.appSkinInfo;
                var bg = skin.panelBackgroundColor.color;
                var avg = (bg.red + bg.green + bg.blue) / 3;

                var root = document.documentElement;
                if (avg < 80) {
                    // Darkest theme (~#1e1e1e to #323232)
                    root.style.setProperty("--bg-color", "#262626");
                    root.style.setProperty("--fg-color", "#e0e0e0");
                    root.style.setProperty("--input-bg", "#363636");
                    root.style.setProperty("--border-color", "#4a4a4a");
                    root.style.setProperty("--secondary-bg", "#3a3a3a");
                } else if (avg < 160) {
                    // Medium dark theme (~#383838 to #535353)
                    root.style.setProperty("--bg-color", "#383838");
                    root.style.setProperty("--fg-color", "#f0f0f0");
                    root.style.setProperty("--input-bg", "#454545");
                    root.style.setProperty("--border-color", "#555555");
                    root.style.setProperty("--secondary-bg", "#484848");
                } else if (avg < 220) {
                    // Medium light theme (~#b8b8b8)
                    root.style.setProperty("--bg-color", "#b8b8b8");
                    root.style.setProperty("--fg-color", "#1a1a1a");
                    root.style.setProperty("--input-bg", "#e0e0e0");
                    root.style.setProperty("--input-border", "#999999");
                    root.style.setProperty("--border-color", "#999999");
                    root.style.setProperty("--secondary-bg", "#c8c8c8");
                } else {
                    // Lightest theme (~#f0f0f0)
                    root.style.setProperty("--bg-color", "#f0f0f0");
                    root.style.setProperty("--fg-color", "#222222");
                    root.style.setProperty("--input-bg", "#ffffff");
                    root.style.setProperty("--input-border", "#cccccc");
                    root.style.setProperty("--border-color", "#d0d0d0");
                    root.style.setProperty("--secondary-bg", "#e2e2e2");
                }
            } catch (err) {}
        }

        applySkinInfo();
        window.__adobe_cep__.addEventListener("com.adobe.csxs.events.ThemeColorChanged", applySkinInfo);
    }
}());
