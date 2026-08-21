(function () {
    "use strict";

    var storageKey = "layerFilterSettingsV1";
    var defaults = {
        mode: "price",
        query: "",
        matchKind: 0,
        includeHidden: false,
        matchFont: true,
        matchSize: true,
        matchColor: true,
        matchFace: true
    };

    var queryInput = document.getElementById("query");
    var matchKind = document.getElementById("match-kind");
    var includeHidden = document.getElementById("include-hidden");
    var matchFont = document.getElementById("match-font");
    var matchSize = document.getElementById("match-size");
    var matchColor = document.getElementById("match-color");
    var matchFace = document.getElementById("match-face");
    var styleOptions = document.getElementById("style-options");
    var selectButton = document.getElementById("select-layers");
    var status = document.getElementById("status");
    var modeInputs = document.querySelectorAll('input[name="mode"]');

    restoreSettings();
    updateControls();

    for (var i = 0; i < modeInputs.length; i++) {
        modeInputs[i].addEventListener("change", function () {
            updateControls();
            saveSettings();
        });
    }

    var persistentControls = [queryInput, matchKind, includeHidden, matchFont, matchSize, matchColor, matchFace];
    for (var j = 0; j < persistentControls.length; j++) {
        persistentControls[j].addEventListener("change", saveSettings);
    }
    queryInput.addEventListener("input", saveSettings);
    selectButton.addEventListener("click", runSelection);

    function currentMode() {
        var checked = document.querySelector('input[name="mode"]:checked');
        return checked ? checked.value : "price";
    }

    function updateControls() {
        var mode = currentMode();
        var needsQuery = mode === "content" || mode === "name" || mode === "group";
        queryInput.disabled = !needsQuery;
        matchKind.disabled = mode !== "content";
        styleOptions.disabled = mode !== "style";
    }

    function readSettings() {
        return {
            mode: currentMode(),
            query: queryInput.value,
            matchKind: Number(matchKind.value),
            includeHidden: includeHidden.checked,
            matchFont: matchFont.checked,
            matchSize: matchSize.checked,
            matchColor: matchColor.checked,
            matchFace: matchFace.checked
        };
    }

    function saveSettings() {
        try {
            localStorage.setItem(storageKey, JSON.stringify(readSettings()));
        } catch (error) {
            // The panel remains usable if CEP storage is unavailable.
        }
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
        matchFont.checked = settings.matchFont;
        matchSize.checked = settings.matchSize;
        matchColor.checked = settings.matchColor;
        matchFace.checked = settings.matchFace;
    }

    function runSelection() {
        var settings = readSettings();
        var needsQuery = settings.mode === "content" || settings.mode === "name" || settings.mode === "group";
        if (needsQuery && !settings.query.replace(/^\s+|\s+$/g, "")) {
            showStatus("请输入关键词。", true);
            queryInput.focus();
            return;
        }

        if (settings.mode === "style" && !settings.matchFont && !settings.matchSize &&
            !settings.matchColor && !settings.matchFace) {
            showStatus("请至少选择一个样式匹配项目。", true);
            return;
        }

        if (settings.mode === "content" && settings.matchKind === 3) {
            try {
                new RegExp(settings.query);
            } catch (error) {
                showStatus("正则表达式无效。", true);
                return;
            }
        }

        saveSettings();
        selectButton.disabled = true;
        showStatus("正在筛选...", false);

        var script = "LayerFilter.selectLayers(" + [
            quote(settings.mode),
            quote(settings.query),
            settings.matchKind,
            settings.includeHidden,
            settings.matchFont,
            settings.matchSize,
            settings.matchColor,
            settings.matchFace
        ].join(",") + ")";

        window.__adobe_cep__.evalScript(script, function (result) {
            selectButton.disabled = false;
            if (!result || result === "EvalScript error.") {
                showStatus("Photoshop 未能执行筛选。", true);
                return;
            }
            if (result.indexOf("OK|") === 0) {
                showStatus("已选择 " + result.substring(3) + " 个图层。", false, true);
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
}());
