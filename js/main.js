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

    // DOM Elements
    var queryInput = document.getElementById("query");
    var matchKind = document.getElementById("match-kind");
    var includeHidden = document.getElementById("include-hidden");
    var ignoreCase = document.getElementById("ignore-case");
    var layerTypeSelect = document.getElementById("layer-type");
    var layerTypeRow = document.getElementById("layer-type-row");
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
    var btnPickName = document.getElementById("btn-pick-name");
    var status = document.getElementById("status");
    var modeInputs = document.querySelectorAll('input[name="mode"]');

    var allActionButtons = [selectButton, btnShow, btnHide, btnLock, btnGroup];

    initThemeSync();
    restoreSettings();
    updateControls();

    // Mode change listener
    for (var i = 0; i < modeInputs.length; i++) {
        modeInputs[i].addEventListener("change", function () {
            updateControls();
            saveSettings();
        });
    }

    // Controls change listeners
    var persistentControls = [
        queryInput, matchKind, includeHidden, ignoreCase,
        layerTypeSelect, matchFont, matchSize, matchColor, matchFace
    ];
    for (var j = 0; j < persistentControls.length; j++) {
        persistentControls[j].addEventListener("change", saveSettings);
    }
    queryInput.addEventListener("input", saveSettings);

    // Keyboard Enter trigger
    queryInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.keyCode === 13) {
            e.preventDefault();
            executeAction("select");
        }
    });

    // Action button clicks
    selectButton.addEventListener("click", function () { executeAction("select"); });
    btnShow.addEventListener("click", function () { executeAction("show"); });
    btnHide.addEventListener("click", function () { executeAction("hide"); });
    btnLock.addEventListener("click", function () { executeAction("lock"); });
    btnGroup.addEventListener("click", function () { executeAction("group"); });

    // Pick active layer name and fill into query
    btnPickName.addEventListener("click", function () {
        if (typeof window.__adobe_cep__ === "undefined" || !window.__adobe_cep__.evalScript) {
            queryInput.value = "测试图层名称";
            saveSettings();
            showStatus("离线模式：已填入测试图层名", false, true);
            return;
        }

        showStatus("正在获取当前图层名称...", false);
        window.__adobe_cep__.evalScript("LayerFilter.getActiveLayerName()", function (result) {
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

    function updateControls() {
        var mode = currentMode();

        // Layer type row visibility
        if (mode === "type") {
            layerTypeRow.classList.remove("hidden");
        } else {
            layerTypeRow.classList.add("hidden");
        }

        // Query input availability
        var needsQuery = mode === "content" || mode === "name" || mode === "group";
        var allowsQuery = needsQuery || mode === "price";
        queryInput.disabled = !allowsQuery;
        if (mode === "price") {
            queryInput.placeholder = "可选：输入自定义符号或关键词";
        } else if (mode === "type") {
            queryInput.placeholder = "按类型无需关键词";
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
            layerType: layerTypeSelect.value,
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
        layerTypeSelect.value = settings.layerType || "text";
        matchFont.checked = settings.matchFont;
        matchSize.checked = settings.matchSize;
        matchColor.checked = settings.matchColor;
        matchFace.checked = settings.matchFace;
    }

    function setButtonsDisabled(disabled) {
        for (var k = 0; k < allActionButtons.length; k++) {
            allActionButtons[k].disabled = disabled;
        }
    }

    function executeAction(actionType) {
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

        if ((settings.mode === "content" || settings.mode === "name" || settings.mode === "group") && settings.matchKind === 3) {
            try {
                new RegExp(settings.query);
            } catch (error) {
                showStatus("正则表达式语法无效。", true);
                return;
            }
        }

        saveSettings();
        setButtonsDisabled(true);
        showStatus("正在筛选与处理...", false);

        if (typeof window.__adobe_cep__ === "undefined" || !window.__adobe_cep__.evalScript) {
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
            false, // scopeGroupOnly
            quote(settings.layerType),
            settings.matchFont,
            settings.matchSize,
            settings.matchColor,
            settings.matchFace
        ].join(",") + ")";

        window.__adobe_cep__.evalScript(script, function (result) {
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
