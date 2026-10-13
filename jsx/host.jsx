#target photoshop

var LayerFilter = LayerFilter || {};

LayerFilter.runAction = function (
    action,         // 'select', 'show', 'hide', 'lock', 'unlock', 'group'
    mode,           // 'price', 'style', 'content', 'name', 'group', 'type'
    query,          // string
    matchKind,      // 0: contains, 1: startsWith, 2: exact, 3: regex
    includeHidden,  // boolean
    ignoreCase,     // boolean
    scopeGroupOnly, // boolean
    layerType,      // 'text', 'smartObject', 'shape', 'pixel', 'adjustment', 'group'
    matchFont,      // boolean
    matchSize,      // boolean
    matchColor,     // boolean
    matchFace       // boolean
) {
    if (app.documents.length === 0) {
        return "ERR|请先打开一个 Photoshop 文档。";
    }

    try {
        var startTime = new Date().getTime();
        var doc = app.activeDocument;
        var referenceStyle = null;

        if (mode === "style") {
            referenceStyle = LayerFilter.readReferenceStyle();
            if (!referenceStyle) {
                return "ERR|请先在图层面板中选中一个文字图层。";
            }
        }

        var settings = {
            action: action || "select",
            mode: mode || "price",
            query: String(query || ""),
            matchKind: Number(matchKind || 0),
            includeHidden: Boolean(includeHidden),
            ignoreCase: Boolean(ignoreCase),
            scopeGroupOnly: Boolean(scopeGroupOnly),
            layerType: layerType || "text",
            matchFont: Boolean(matchFont),
            matchSize: Boolean(matchSize),
            matchColor: Boolean(matchColor),
            matchFace: Boolean(matchFace)
        };

        // Scan layers via high-performance Action Manager
        var layers = LayerFilter.scanLayers(settings.includeHidden, settings.scopeGroupOnly);
        if (!layers || layers.length === 0) {
            return "ERR|未找到可供筛选的图层。";
        }

        var matchedIds = [];
        for (var index = 0; index < layers.length; index++) {
            var item = layers[index];
            if (LayerFilter.matches(item, settings, referenceStyle)) {
                matchedIds.push(item.id);
            }
        }

        if (matchedIds.length === 0) {
            return "ERR|没有找到符合条件的图层。";
        }

        // Execute batch action
        var actionResult = LayerFilter.executeBatchAction(settings.action, matchedIds);
        if (actionResult && actionResult.indexOf("ERR|") === 0) {
            return actionResult;
        }

        var elapsedMs = new Date().getTime() - startTime;
        var actionDesc = LayerFilter.getActionText(settings.action);
        return "OK|" + matchedIds.length + "|" + elapsedMs + "|" + actionDesc;
    } catch (error) {
        return "ERR|" + error.message;
    }
};

LayerFilter.getActionText = function (action) {
    switch (action) {
        case "show": return "已显示";
        case "hide": return "已隐藏";
        case "lock": return "已锁定";
        case "unlock": return "已解锁";
        case "group": return "已选中并编组";
        default: return "已选中";
    }
};

LayerFilter.executeBatchAction = function (action, ids) {
    try {
        if (action === "show") {
            LayerFilter.setLayersVisibility(ids, true);
        } else if (action === "hide") {
            LayerFilter.setLayersVisibility(ids, false);
        } else if (action === "lock") {
            LayerFilter.setLayersLock(ids, true);
        } else if (action === "unlock") {
            LayerFilter.setLayersLock(ids, false);
        } else if (action === "group") {
            LayerFilter.selectLayerIds(ids);
            LayerFilter.groupSelectedLayers("筛选图层组");
        } else {
            // Default: select
            LayerFilter.selectLayerIds(ids);
        }
        return "OK";
    } catch (err) {
        return "ERR|" + err.message;
    }
};

// Scan layers using Action Manager (10x-50x faster than DOM traversal)
LayerFilter.scanLayers = function (includeHidden, scopeGroupOnly) {
    try {
        var docRef = new ActionReference();
        docRef.putProperty(charIDToTypeID("Prpr"), stringIDToTypeID("numberOfLayers"));
        docRef.putEnumerated(charIDToTypeID("Dcmn"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        var docDesc = executeActionGet(docRef);
        var total = docDesc.getInteger(stringIDToTypeID("numberOfLayers"));

        var bgRef = new ActionReference();
        bgRef.putProperty(charIDToTypeID("Prpr"), stringIDToTypeID("hasBackgroundLayer"));
        bgRef.putEnumerated(charIDToTypeID("Dcmn"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        var hasBg = executeActionGet(bgRef).getBoolean(stringIDToTypeID("hasBackgroundLayer"));

        var startIndex = hasBg ? 0 : 1;
        var layers = [];
        var groupVisStack = [];

        // Scan from top (total) down to bottom (startIndex)
        for (var i = total; i >= startIndex; i--) {
            try {
                var ref = new ActionReference();
                ref.putIndex(charIDToTypeID("Lyr "), i);
                var desc = executeActionGet(ref);

                var id = desc.getInteger(stringIDToTypeID("layerID"));
                var name = desc.getString(charIDToTypeID("Nm  "));
                var visible = desc.getBoolean(charIDToTypeID("Vsbl"));

                var section = "content";
                if (desc.hasKey(stringIDToTypeID("layerSection"))) {
                    var secType = desc.getEnumerationValue(stringIDToTypeID("layerSection"));
                    if (secType === stringIDToTypeID("layerSectionStart")) {
                        section = "start";
                    } else if (secType === stringIDToTypeID("layerSectionEnd")) {
                        section = "end";
                    }
                }

                if (section === "end") {
                    if (groupVisStack.length > 0) {
                        groupVisStack.pop();
                    }
                    continue;
                }

                var parentVisible = true;
                for (var v = 0; v < groupVisStack.length; v++) {
                    if (!groupVisStack[v]) {
                        parentVisible = false;
                        break;
                    }
                }
                var effectiveVisible = parentVisible && visible;

                if (section === "start") {
                    groupVisStack.push(visible);
                    if (includeHidden || effectiveVisible) {
                        layers.push({
                            id: id,
                            name: name,
                            isGroup: true,
                            kind: "group",
                            visible: effectiveVisible,
                            textContent: "",
                            textStyle: null
                        });
                    }
                    continue;
                }

                if (!includeHidden && !effectiveVisible) {
                    continue;
                }

                var kind = "other";
                var textContent = "";
                var textStyle = null;

                if (desc.hasKey(stringIDToTypeID("layerKind"))) {
                    var k = desc.getInteger(stringIDToTypeID("layerKind"));
                    if (k === 1) kind = "pixel";
                    else if (k === 2) kind = "adjustment";
                    else if (k === 3) kind = "text";
                    else if (k === 4) kind = "shape";
                    else if (k === 5) kind = "smartObject";
                }

                if (desc.hasKey(charIDToTypeID("Txt "))) {
                    kind = "text";
                    var textDesc = desc.getObjectValue(charIDToTypeID("Txt "));
                    if (textDesc.hasKey(charIDToTypeID("Txt "))) {
                        textContent = textDesc.getString(charIDToTypeID("Txt "));
                    }
                    textStyle = LayerFilter.extractTextStyleFromDesc(textDesc);
                }

                layers.push({
                    id: id,
                    name: name,
                    isGroup: false,
                    kind: kind,
                    visible: effectiveVisible,
                    textContent: textContent,
                    textStyle: textStyle
                });
            } catch (layerErr) {
                // Safely skip any layer that cannot be read
            }
        }
        return layers;
    } catch (e) {
        return LayerFilter.scanLayersDOM(includeHidden);
    }
};

// Fallback scan using Photoshop DOM
LayerFilter.scanLayersDOM = function (includeHidden) {
    var result = [];
    try {
        var doc = app.activeDocument;
        LayerFilter.collectDOMRecursive(doc, true, includeHidden, result);
    } catch (e) {}
    return result;
};

LayerFilter.collectDOMRecursive = function (container, parentVisible, includeHidden, result) {
    for (var i = 0; i < container.layers.length; i++) {
        var layer = container.layers[i];
        var effectiveVisible = parentVisible && layer.visible;
        var isGroup = layer.typename === "LayerSet";

        if (includeHidden || effectiveVisible) {
            var kind = "other";
            var textContent = "";
            var textStyle = null;

            if (isGroup) {
                kind = "group";
            } else if (layer.kind === LayerKind.TEXT) {
                kind = "text";
                try {
                    textContent = layer.textItem.contents;
                    textStyle = LayerFilter.readTextStyleDOM(layer);
                } catch (e) {}
            } else if (layer.kind === LayerKind.SMARTOBJECT) {
                kind = "smartObject";
            } else if (layer.kind === LayerKind.SOLIDFILL) {
                kind = "shape";
            } else if (layer.kind === LayerKind.NORMAL) {
                kind = "pixel";
            }

            result.push({
                id: layer.id,
                name: layer.name,
                isGroup: isGroup,
                kind: kind,
                visible: effectiveVisible,
                textContent: textContent,
                textStyle: textStyle
            });
        }

        if (isGroup) {
            LayerFilter.collectDOMRecursive(layer, effectiveVisible, includeHidden, result);
        }
    }
};

LayerFilter.matches = function (layer, settings, referenceStyle) {
    var query = settings.query;
    var ignoreCase = settings.ignoreCase;

    // 1. Filter by Layer Type
    if (settings.mode === "type") {
        if (settings.layerType === "group") return layer.isGroup;
        if (layer.isGroup) return false;
        return layer.kind === settings.layerType;
    }

    // 2. Filter by Price Text
    if (settings.mode === "price") {
        if (layer.kind !== "text" && !layer.textContent) return false;
        var text = layer.textContent;
        if (query && query.replace(/^\s+|\s+$/g, "")) {
            return LayerFilter.textMatches(text, query, 0, ignoreCase);
        }
        // Extended default price patterns: ￥, ¥, $, €, £, HK$, NT$, RMB, 到手价, 券后, 特价, 现价, 专柜价, xx元
        var priceRegex = /[￥¥$€£]|(?:RMB)|(?:HK\$)|(?:NT\$)|(?:到手价)|(?:券后)|(?:特价)|(?:现价)|(?:专柜价)|(?:原价)|(?:\b\d+(\.\d{1,2})?\s*元)/i;
        return priceRegex.test(text);
    }

    // 3. Filter by Layer Name
    if (settings.mode === "name") {
        return LayerFilter.textMatches(layer.name, query, settings.matchKind, ignoreCase);
    }

    // 4. Filter by Group Name
    if (settings.mode === "group") {
        if (!layer.isGroup) return false;
        return LayerFilter.textMatches(layer.name, query, settings.matchKind, ignoreCase);
    }

    // 5. Filter by Text Content
    if (settings.mode === "content") {
        if (layer.kind !== "text" && !layer.textContent) return false;
        return LayerFilter.textMatches(layer.textContent, query, settings.matchKind, ignoreCase);
    }

    // 6. Filter by Text Style
    if (settings.mode === "style") {
        if (layer.kind !== "text" || !layer.textStyle || !referenceStyle) return false;
        var candidate = layer.textStyle;

        if (settings.matchFont && referenceStyle.font !== null) {
            if (!candidate.font || candidate.font !== referenceStyle.font) return false;
        }

        if (settings.matchSize && referenceStyle.size !== null) {
            if (candidate.size === null || Math.abs(candidate.size - referenceStyle.size) > 0.5) {
                return false;
            }
        }

        if (settings.matchColor && referenceStyle.color !== null) {
            if (!candidate.color || !LayerFilter.colorMatches(candidate.color, referenceStyle.color, 6)) {
                return false;
            }
        }

        if (settings.matchFace) {
            if (referenceStyle.fauxBold !== null && candidate.fauxBold !== referenceStyle.fauxBold) {
                return false;
            }
            if (referenceStyle.fauxItalic !== null && candidate.fauxItalic !== referenceStyle.fauxItalic) {
                return false;
            }
        }

        return true;
    }

    return false;
};

LayerFilter.textMatches = function (source, query, kind, ignoreCase) {
    if (!source) source = "";
    if (!query) return true;

    var s = ignoreCase ? source.toLowerCase() : source;
    var q = ignoreCase ? query.toLowerCase() : query;

    if (kind === 0) { // Contains
        return s.indexOf(q) !== -1;
    }
    if (kind === 1) { // Starts with
        return s.indexOf(q) === 0;
    }
    if (kind === 2) { // Exact match
        return s === q;
    }
    if (kind === 3) { // Regular Expression
        try {
            var flags = ignoreCase ? "i" : "";
            return new RegExp(query, flags).test(source);
        } catch (e) {
            return false;
        }
    }
    return false;
};

LayerFilter.colorMatches = function (c1, c2, tolerance) {
    if (!c1 || !c2) return false;
    var tol = (tolerance !== undefined) ? tolerance : 5;
    return Math.abs(c1.r - c2.r) <= tol &&
           Math.abs(c1.g - c2.g) <= tol &&
           Math.abs(c1.b - c2.b) <= tol;
};

LayerFilter.extractTextStyleFromDesc = function (textDesc) {
    try {
        if (!textDesc.hasKey(stringIDToTypeID("textStyleRange"))) return null;
        var ranges = textDesc.getList(stringIDToTypeID("textStyleRange"));
        if (ranges.count === 0) return null;
        var firstRange = ranges.getObjectValue(0);
        if (!firstRange.hasKey(stringIDToTypeID("textStyle"))) return null;
        var style = firstRange.getObjectValue(stringIDToTypeID("textStyle"));

        var font = style.hasKey(stringIDToTypeID("fontPostScriptName")) ? style.getString(stringIDToTypeID("fontPostScriptName")) : null;
        var size = style.hasKey(stringIDToTypeID("size")) ? style.getUnitDoubleValue(stringIDToTypeID("size")) : null;

        var color = null;
        if (style.hasKey(charIDToTypeID("Clr "))) {
            var colorDesc = style.getObjectValue(charIDToTypeID("Clr "));
            if (colorDesc.hasKey(charIDToTypeID("Rd  "))) {
                color = {
                    r: Math.round(colorDesc.getDouble(charIDToTypeID("Rd  "))),
                    g: Math.round(colorDesc.getDouble(charIDToTypeID("Grn "))),
                    b: Math.round(colorDesc.getDouble(charIDToTypeID("Bl  ")))
                };
            }
        }

        var fauxBold = style.hasKey(stringIDToTypeID("fauxBold")) ? style.getBoolean(stringIDToTypeID("fauxBold")) : false;
        var fauxItalic = style.hasKey(stringIDToTypeID("fauxItalic")) ? style.getBoolean(stringIDToTypeID("fauxItalic")) : false;

        return {
            font: font,
            size: size,
            color: color,
            fauxBold: fauxBold,
            fauxItalic: fauxItalic
        };
    } catch (e) {
        return null;
    }
};

LayerFilter.readReferenceStyle = function () {
    try {
        var ref = new ActionReference();
        ref.putProperty(charIDToTypeID("Prpr"), charIDToTypeID("Txt "));
        ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        var layerDesc = executeActionGet(ref);
        if (layerDesc.hasKey(charIDToTypeID("Txt "))) {
            var style = LayerFilter.extractTextStyleFromDesc(layerDesc.getObjectValue(charIDToTypeID("Txt ")));
            if (style) return style;
        }
    } catch (e) {}

    try {
        var active = app.activeDocument.activeLayer;
        if (active && active.typename === "ArtLayer" && active.kind === LayerKind.TEXT) {
            return LayerFilter.readTextStyleDOM(active);
        }
    } catch (e) {}
    return null;
};

LayerFilter.readTextStyleDOM = function (layer) {
    try {
        var item = layer.textItem;
        var rgb = null;
        try {
            var c = item.color.rgb;
            rgb = { r: Math.round(c.red), g: Math.round(c.green), b: Math.round(c.blue) };
        } catch (e) {}

        return {
            font: LayerFilter.safeValue(function () { return String(item.font); }),
            size: LayerFilter.safeValue(function () { return Number(item.size.as("pt")); }),
            color: rgb,
            fauxBold: LayerFilter.safeValue(function () { return Boolean(item.fauxBold); }),
            fauxItalic: LayerFilter.safeValue(function () { return Boolean(item.fauxItalic); })
        };
    } catch (e) {
        return null;
    }
};

// Batch select layer IDs
LayerFilter.selectLayerIds = function (ids) {
    if (!ids || ids.length === 0) return;
    LayerFilter.selectLayerById(ids[0], false);
    for (var index = 1; index < ids.length; index++) {
        LayerFilter.selectLayerById(ids[index], true);
    }
};

LayerFilter.selectLayerById = function (layerId, addToSelection) {
    var descriptor = new ActionDescriptor();
    var reference = new ActionReference();
    reference.putIdentifier(charIDToTypeID("Lyr "), layerId);
    descriptor.putReference(charIDToTypeID("null"), reference);
    if (addToSelection) {
        descriptor.putEnumerated(
            stringIDToTypeID("selectionModifier"),
            stringIDToTypeID("selectionModifierType"),
            stringIDToTypeID("addToSelection")
        );
    }
    descriptor.putBoolean(charIDToTypeID("MkVs"), false);
    executeAction(charIDToTypeID("slct"), descriptor, DialogModes.NO);
};

// Batch set layer visibility (Show / Hide in single or batched Action Manager call)
LayerFilter.setLayersVisibility = function (ids, makeVisible) {
    if (!ids || ids.length === 0) return;
    try {
        var list = new ActionList();
        for (var i = 0; i < ids.length; i++) {
            var ref = new ActionReference();
            ref.putIdentifier(charIDToTypeID("Lyr "), ids[i]);
            list.putReference(ref);
        }
        var desc = new ActionDescriptor();
        desc.putList(charIDToTypeID("null"), list);
        executeAction(charIDToTypeID(makeVisible ? "Shw " : "Hd  "), desc, DialogModes.NO);
    } catch (e) {
        LayerFilter.selectLayerIds(ids);
        var desc2 = new ActionDescriptor();
        var list2 = new ActionList();
        var ref2 = new ActionReference();
        ref2.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        list2.putReference(ref2);
        desc2.putList(charIDToTypeID("null"), list2);
        executeAction(charIDToTypeID(makeVisible ? "Shw " : "Hd  "), desc2, DialogModes.NO);
    }
};

// Batch lock / unlock layers
LayerFilter.setLayersLock = function (ids, lock) {
    if (!ids || ids.length === 0) return;
    LayerFilter.selectLayerIds(ids);
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    desc.putReference(charIDToTypeID("null"), ref);
    var lockDesc = new ActionDescriptor();
    lockDesc.putBoolean(stringIDToTypeID("protectAll"), lock);
    desc.putObject(charIDToTypeID("T   "), stringIDToTypeID("layerLocking"), lockDesc);
    executeAction(stringIDToTypeID("applyLocking"), desc, DialogModes.NO);
};

// Batch group selected layers
LayerFilter.groupSelectedLayers = function (groupName) {
    try {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putClass(stringIDToTypeID("layerSection"));
        desc.putReference(charIDToTypeID("null"), ref);
        var fromRef = new ActionReference();
        fromRef.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        desc.putReference(charIDToTypeID("from"), fromRef);
        if (groupName) {
            var nameDesc = new ActionDescriptor();
            nameDesc.putString(charIDToTypeID("Nm  "), groupName);
            desc.putObject(charIDToTypeID("Usng"), stringIDToTypeID("layerSection"), nameDesc);
        }
        executeAction(charIDToTypeID("Mk  "), desc, DialogModes.NO);
    } catch (e) {}
};

LayerFilter.safeValue = function (getter) {
    try {
        return getter();
    } catch (error) {
        return null;
    }
};

// Get active layer name
LayerFilter.getActiveLayerName = function () {
    if (app.documents.length === 0) {
        return "ERR|请先打开一个 Photoshop 文档。";
    }
    try {
        var ref = new ActionReference();
        ref.putProperty(charIDToTypeID("Prpr"), charIDToTypeID("Nm  "));
        ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        var desc = executeActionGet(ref);
        if (desc.hasKey(charIDToTypeID("Nm  "))) {
            return "OK|" + desc.getString(charIDToTypeID("Nm  "));
        }
    } catch (e) {}

    try {
        var layer = app.activeDocument.activeLayer;
        if (layer) {
            return "OK|" + String(layer.name);
        }
    } catch (e2) {}

    return "ERR|未获取到当前选中的图层。";
};
