#target photoshop

var LayerFilter = LayerFilter || {};

// Module-level TypeID cache to eliminate thousands of repeated stringID/charID conversions
LayerFilter.IDs = {
    Lyr: charIDToTypeID("Lyr "),
    Dcmn: charIDToTypeID("Dcmn"),
    Ordn: charIDToTypeID("Ordn"),
    Trgt: charIDToTypeID("Trgt"),
    Prpr: charIDToTypeID("Prpr"),
    nullID: charIDToTypeID("null"),
    slct: charIDToTypeID("slct"),
    MkVs: charIDToTypeID("MkVs"),
    Shw: charIDToTypeID("Shw "),
    Hd: charIDToTypeID("Hd  "),
    Mk: charIDToTypeID("Mk  "),
    from: charIDToTypeID("from"),
    Usng: charIDToTypeID("Usng"),
    T: charIDToTypeID("T   "),
    Txt: charIDToTypeID("Txt "),
    Nm: charIDToTypeID("Nm  "),
    Vsbl: charIDToTypeID("Vsbl"),
    Clr: charIDToTypeID("Clr "),
    Rd: charIDToTypeID("Rd  "),
    Grn: charIDToTypeID("Grn "),
    Bl: charIDToTypeID("Bl  "),
    LyrI: charIDToTypeID("LyrI"),
    CpFX: charIDToTypeID("CpFX"),
    PaFX: charIDToTypeID("PaFX"),
    numberOfLayers: stringIDToTypeID("numberOfLayers"),
    hasBackgroundLayer: stringIDToTypeID("hasBackgroundLayer"),
    layerID: stringIDToTypeID("layerID"),
    layerSection: stringIDToTypeID("layerSection"),
    layerSectionStart: stringIDToTypeID("layerSectionStart"),
    layerSectionEnd: stringIDToTypeID("layerSectionEnd"),
    layerKind: stringIDToTypeID("layerKind"),
    textStyleRange: stringIDToTypeID("textStyleRange"),
    textStyle: stringIDToTypeID("textStyle"),
    fontPostScriptName: stringIDToTypeID("fontPostScriptName"),
    size: stringIDToTypeID("size"),
    fauxBold: stringIDToTypeID("fauxBold"),
    fauxItalic: stringIDToTypeID("fauxItalic"),
    selectionModifier: stringIDToTypeID("selectionModifier"),
    selectionModifierType: stringIDToTypeID("selectionModifierType"),
    addToSelection: stringIDToTypeID("addToSelection"),
    protectAll: stringIDToTypeID("protectAll"),
    layerLocking: stringIDToTypeID("layerLocking"),
    applyLocking: stringIDToTypeID("applyLocking"),
    targetLayersIDs: stringIDToTypeID("targetLayersIDs"),
    copyEffects: stringIDToTypeID("copyEffects"),
    pasteEffects: stringIDToTypeID("pasteEffects")
};

LayerFilter.runAction = function (
    action,         // 'select', 'show', 'hide', 'lock', 'unlock', 'group'
    mode,           // 'price', 'style', 'content', 'name', 'group', 'type'
    query,          // string
    matchKind,      // 0: contains, 1: startsWith, 2: exact, 3: regex
    includeHidden,  // boolean
    ignoreCase,     // boolean
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
            layerType: layerType || "text",
            matchFont: Boolean(matchFont),
            matchSize: Boolean(matchSize),
            matchColor: Boolean(matchColor),
            matchFace: Boolean(matchFace)
        };

        // Scan layers via high-performance Action Manager (with on-demand descriptor reading)
        var layers = LayerFilter.scanLayers(settings.includeHidden, settings.mode);
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
            var grpResult = LayerFilter.groupSelectedLayers("筛选图层组");
            if (grpResult && grpResult.indexOf("ERR|") === 0) {
                return grpResult;
            }
        } else {
            // Default: select
            LayerFilter.selectLayerIds(ids);
        }
        return "OK";
    } catch (err) {
        return "ERR|" + err.message;
    }
};

// Scan layers using Action Manager (optimized with on-demand text/style parsing)
LayerFilter.scanLayers = function (includeHidden, mode) {
    var IDs = LayerFilter.IDs;
    try {
        var docRef = new ActionReference();
        docRef.putProperty(IDs.Prpr, IDs.numberOfLayers);
        docRef.putEnumerated(IDs.Dcmn, IDs.Ordn, IDs.Trgt);
        var docDesc = executeActionGet(docRef);
        var total = docDesc.getInteger(IDs.numberOfLayers);

        var bgRef = new ActionReference();
        bgRef.putProperty(IDs.Prpr, IDs.hasBackgroundLayer);
        bgRef.putEnumerated(IDs.Dcmn, IDs.Ordn, IDs.Trgt);
        var hasBg = executeActionGet(bgRef).getBoolean(IDs.hasBackgroundLayer);

        var startIndex = hasBg ? 0 : 1;
        var layers = [];
        var groupVisStack = [];

        // Flags for on-demand descriptor retrieval
        var needTextContent = (mode === "price" || mode === "content");
        var needTextStyle = (mode === "style");

        // Scan from top (total) down to bottom (startIndex)
        for (var i = total; i >= startIndex; i--) {
            try {
                var ref = new ActionReference();
                ref.putIndex(IDs.Lyr, i);
                var desc = executeActionGet(ref);

                var id = desc.getInteger(IDs.layerID);
                var name = desc.getString(IDs.Nm);
                var visible = desc.getBoolean(IDs.Vsbl);

                var section = "content";
                if (desc.hasKey(IDs.layerSection)) {
                    var secType = desc.getEnumerationValue(IDs.layerSection);
                    if (secType === IDs.layerSectionStart) {
                        section = "start";
                    } else if (secType === IDs.layerSectionEnd) {
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

                if (desc.hasKey(IDs.layerKind)) {
                    var k = desc.getInteger(IDs.layerKind);
                    if (k === 1) kind = "pixel";
                    else if (k === 2) kind = "adjustment";
                    else if (k === 3) kind = "text";
                    else if (k === 4) kind = "shape";
                    else if (k === 5) kind = "smartObject";
                }

                var hasTxt = desc.hasKey(IDs.Txt);
                if (hasTxt) {
                    kind = "text";
                }

                // On-demand reading: Only read text content or styles when required by current mode
                if (hasTxt) {
                    if (needTextContent) {
                        var textDesc = desc.getObjectValue(IDs.Txt);
                        if (textDesc.hasKey(IDs.Txt)) {
                            textContent = textDesc.getString(IDs.Txt);
                        }
                    } else if (needTextStyle) {
                        var textDesc2 = desc.getObjectValue(IDs.Txt);
                        textStyle = LayerFilter.extractTextStyleFromDesc(textDesc2);
                    }
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

// Extracts text style properties (uses first textStyleRange as benchmark for mixed-style text layers)
LayerFilter.extractTextStyleFromDesc = function (textDesc) {
    try {
        var IDs = LayerFilter.IDs;
        if (!textDesc.hasKey(IDs.textStyleRange)) return null;
        var ranges = textDesc.getList(IDs.textStyleRange);
        if (ranges.count === 0) return null;
        var firstRange = ranges.getObjectValue(0);
        if (!firstRange.hasKey(IDs.textStyle)) return null;
        var style = firstRange.getObjectValue(IDs.textStyle);

        var font = style.hasKey(IDs.fontPostScriptName) ? style.getString(IDs.fontPostScriptName) : null;
        var size = style.hasKey(IDs.size) ? style.getUnitDoubleValue(IDs.size) : null;

        var color = null;
        if (style.hasKey(IDs.Clr)) {
            var colorDesc = style.getObjectValue(IDs.Clr);
            if (colorDesc.hasKey(IDs.Rd)) {
                color = {
                    r: Math.round(colorDesc.getDouble(IDs.Rd)),
                    g: Math.round(colorDesc.getDouble(IDs.Grn)),
                    b: Math.round(colorDesc.getDouble(IDs.Bl))
                };
            }
        }

        var fauxBold = style.hasKey(IDs.fauxBold) ? style.getBoolean(IDs.fauxBold) : false;
        var fauxItalic = style.hasKey(IDs.fauxItalic) ? style.getBoolean(IDs.fauxItalic) : false;

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
        var IDs = LayerFilter.IDs;
        var ref = new ActionReference();
        ref.putProperty(IDs.Prpr, IDs.Txt);
        ref.putEnumerated(IDs.Lyr, IDs.Ordn, IDs.Trgt);
        var layerDesc = executeActionGet(ref);
        if (layerDesc.hasKey(IDs.Txt)) {
            var style = LayerFilter.extractTextStyleFromDesc(layerDesc.getObjectValue(IDs.Txt));
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
    var IDs = LayerFilter.IDs;
    var descriptor = new ActionDescriptor();
    var reference = new ActionReference();
    reference.putIdentifier(IDs.Lyr, layerId);
    descriptor.putReference(IDs.nullID, reference);
    if (addToSelection) {
        descriptor.putEnumerated(
            IDs.selectionModifier,
            IDs.selectionModifierType,
            IDs.addToSelection
        );
    }
    descriptor.putBoolean(IDs.MkVs, false);
    executeAction(IDs.slct, descriptor, DialogModes.NO);
};

// Batch set layer visibility (Show / Hide in single or batched Action Manager call)
LayerFilter.setLayersVisibility = function (ids, makeVisible) {
    if (!ids || ids.length === 0) return;
    var IDs = LayerFilter.IDs;
    try {
        var list = new ActionList();
        for (var i = 0; i < ids.length; i++) {
            var ref = new ActionReference();
            ref.putIdentifier(IDs.Lyr, ids[i]);
            list.putReference(ref);
        }
        var desc = new ActionDescriptor();
        desc.putList(IDs.nullID, list);
        executeAction(makeVisible ? IDs.Shw : IDs.Hd, desc, DialogModes.NO);
    } catch (e) {
        LayerFilter.selectLayerIds(ids);
        var desc2 = new ActionDescriptor();
        var list2 = new ActionList();
        var ref2 = new ActionReference();
        ref2.putEnumerated(IDs.Lyr, IDs.Ordn, IDs.Trgt);
        list2.putReference(ref2);
        desc2.putList(IDs.nullID, list2);
        executeAction(makeVisible ? IDs.Shw : IDs.Hd, desc2, DialogModes.NO);
    }
};

// Batch lock / unlock layers
LayerFilter.setLayersLock = function (ids, lock) {
    if (!ids || ids.length === 0) return;
    var IDs = LayerFilter.IDs;
    LayerFilter.selectLayerIds(ids);
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putEnumerated(IDs.Lyr, IDs.Ordn, IDs.Trgt);
    desc.putReference(IDs.nullID, ref);
    var lockDesc = new ActionDescriptor();
    lockDesc.putBoolean(IDs.protectAll, lock);
    desc.putObject(IDs.T, IDs.layerLocking, lockDesc);
    executeAction(IDs.applyLocking, desc, DialogModes.NO);
};

// Batch group selected layers (now returns error details on failure instead of silent swallowing)
LayerFilter.groupSelectedLayers = function (groupName) {
    try {
        var IDs = LayerFilter.IDs;
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putClass(IDs.layerSection);
        desc.putReference(IDs.nullID, ref);
        var fromRef = new ActionReference();
        fromRef.putEnumerated(IDs.Lyr, IDs.Ordn, IDs.Trgt);
        desc.putReference(IDs.from, fromRef);
        if (groupName) {
            var nameDesc = new ActionDescriptor();
            nameDesc.putString(IDs.Nm, groupName);
            desc.putObject(IDs.Usng, IDs.layerSection, nameDesc);
        }
        executeAction(IDs.Mk, desc, DialogModes.NO);
        return "OK";
    } catch (e) {
        return "ERR|编组失败：" + (e.message || "目标图层无法编组");
    }
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
        var IDs = LayerFilter.IDs;
        var ref = new ActionReference();
        ref.putProperty(IDs.Prpr, IDs.Nm);
        ref.putEnumerated(IDs.Lyr, IDs.Ordn, IDs.Trgt);
        var desc = executeActionGet(ref);
        if (desc.hasKey(IDs.Nm)) {
            return "OK|" + desc.getString(IDs.Nm);
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

// Copy layer style (effects) - supports all layers and layer groups
LayerFilter.copyLayerStyle = function () {
    if (app.documents.length === 0) {
        return "ERR|请先打开一个 Photoshop 文档。";
    }
    var IDs = LayerFilter.IDs;
    try {
        try {
            executeAction(IDs.CpFX, undefined, DialogModes.NO);
        } catch (e1) {
            executeAction(IDs.copyEffects, undefined, DialogModes.NO);
        }
        return "OK|已成功复制当前图层样式";
    } catch (e) {
        return "ERR|当前图层无可用图层样式或未选中图层。";
    }
};

// Paste layer style (effects) to selected layers or groups
LayerFilter.pasteLayerStyle = function () {
    if (app.documents.length === 0) {
        return "ERR|请先打开一个 Photoshop 文档。";
    }
    var IDs = LayerFilter.IDs;
    try {
        try {
            executeAction(IDs.PaFX, undefined, DialogModes.NO);
        } catch (e1) {
            executeAction(IDs.pasteEffects, undefined, DialogModes.NO);
        }
        return "OK|已将样式粘贴至当前选中的图层";
    } catch (e) {
        return "ERR|粘贴样式失败（剪贴板为空或图层被锁定）。";
    }
};
