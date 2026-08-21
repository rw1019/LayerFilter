#target photoshop

var LayerFilter = LayerFilter || {};

LayerFilter.selectLayers = function (
    mode,
    query,
    matchKind,
    includeHidden,
    matchFont,
    matchSize,
    matchColor,
    matchFace
) {
    if (app.documents.length === 0) {
        return "ERR|请先打开一个 Photoshop 文档。";
    }

    try {
        var doc = app.activeDocument;
        var referenceLayer = doc.activeLayer;
        var referenceStyle = null;

        if (mode === "style") {
            if (!LayerFilter.isTextLayer(referenceLayer)) {
                return "ERR|请先在图层面板中选中一个文字图层。";
            }
            referenceStyle = LayerFilter.readTextStyle(referenceLayer);
        }

        var settings = {
            mode: mode,
            query: query,
            matchKind: Number(matchKind),
            includeHidden: Boolean(includeHidden),
            matchFont: Boolean(matchFont),
            matchSize: Boolean(matchSize),
            matchColor: Boolean(matchColor),
            matchFace: Boolean(matchFace)
        };

        var candidates = [];
        if (mode === "group") {
            LayerFilter.collectLayerSets(doc, true, settings.includeHidden, candidates);
        } else if (mode === "name") {
            LayerFilter.collectAllLayers(doc, true, settings.includeHidden, candidates);
        } else {
            LayerFilter.collectTextLayers(doc, true, settings.includeHidden, candidates);
        }

        var matchedIds = [];
        for (var index = 0; index < candidates.length; index++) {
            if (LayerFilter.matches(candidates[index], settings, referenceStyle)) {
                matchedIds.push(candidates[index].id);
            }
        }

        if (matchedIds.length === 0) {
            return "ERR|没有找到符合条件的图层。";
        }

        LayerFilter.selectLayerIds(matchedIds);
        return "OK|" + matchedIds.length;
    } catch (error) {
        return "ERR|" + error.message;
    }
};

LayerFilter.isTextLayer = function (layer) {
    try {
        return layer.typename === "ArtLayer" && layer.kind === LayerKind.TEXT;
    } catch (error) {
        return false;
    }
};

LayerFilter.collectTextLayers = function (container, parentVisible, includeHidden, result) {
    for (var index = 0; index < container.layers.length; index++) {
        var layer = container.layers[index];
        var effectiveVisible = parentVisible && layer.visible;
        if (layer.typename === "LayerSet") {
            LayerFilter.collectTextLayers(layer, effectiveVisible, includeHidden, result);
        } else if (LayerFilter.isTextLayer(layer) && (includeHidden || effectiveVisible)) {
            result.push(layer);
        }
    }
};

LayerFilter.collectAllLayers = function (container, parentVisible, includeHidden, result) {
    for (var index = 0; index < container.layers.length; index++) {
        var layer = container.layers[index];
        var effectiveVisible = parentVisible && layer.visible;
        if (includeHidden || effectiveVisible) {
            result.push(layer);
        }
        if (layer.typename === "LayerSet") {
            LayerFilter.collectAllLayers(layer, effectiveVisible, includeHidden, result);
        }
    }
};

LayerFilter.collectLayerSets = function (container, parentVisible, includeHidden, result) {
    for (var index = 0; index < container.layers.length; index++) {
        var layer = container.layers[index];
        var effectiveVisible = parentVisible && layer.visible;
        if (layer.typename === "LayerSet") {
            if (includeHidden || effectiveVisible) {
                result.push(layer);
            }
            LayerFilter.collectLayerSets(layer, effectiveVisible, includeHidden, result);
        }
    }
};

LayerFilter.matches = function (layer, settings, referenceStyle) {
    if (settings.mode === "price") {
        var priceText = LayerFilter.safeString(function () { return layer.textItem.contents; });
        return priceText.indexOf("￥") !== -1 || priceText.indexOf("¥") !== -1;
    }

    if (settings.mode === "name" || settings.mode === "group") {
        return String(layer.name).indexOf(settings.query) !== -1;
    }

    if (settings.mode === "content") {
        var content = LayerFilter.safeString(function () { return layer.textItem.contents; });
        if (settings.matchKind === 0) {
            return content.indexOf(settings.query) !== -1;
        }
        if (settings.matchKind === 1) {
            return content.indexOf(settings.query) === 0;
        }
        if (settings.matchKind === 2) {
            return content === settings.query;
        }
        return new RegExp(settings.query).test(content);
    }

    var candidate = LayerFilter.readTextStyle(layer);
    if (settings.matchFont && referenceStyle.font !== null && candidate.font !== referenceStyle.font) {
        return false;
    }
    if (settings.matchSize && referenceStyle.size !== null &&
        !LayerFilter.nearlyEqual(candidate.size, referenceStyle.size, 0.01)) {
        return false;
    }
    if (settings.matchColor && referenceStyle.color !== null && candidate.color !== referenceStyle.color) {
        return false;
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
};

LayerFilter.readTextStyle = function (layer) {
    var textItem = layer.textItem;
    return {
        font: LayerFilter.safeValue(function () { return String(textItem.font); }),
        size: LayerFilter.safeValue(function () { return Number(textItem.size.as("pt")); }),
        color: LayerFilter.safeValue(function () {
            var rgb = textItem.color.rgb;
            return LayerFilter.roundColor(rgb.red) + "," +
                LayerFilter.roundColor(rgb.green) + "," + LayerFilter.roundColor(rgb.blue);
        }),
        fauxBold: LayerFilter.safeValue(function () { return Boolean(textItem.fauxBold); }),
        fauxItalic: LayerFilter.safeValue(function () { return Boolean(textItem.fauxItalic); })
    };
};

LayerFilter.selectLayerIds = function (ids) {
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

LayerFilter.safeValue = function (getter) {
    try {
        return getter();
    } catch (error) {
        return null;
    }
};

LayerFilter.safeString = function (getter) {
    var value = LayerFilter.safeValue(getter);
    return value === null ? "" : String(value);
};

LayerFilter.nearlyEqual = function (left, right, tolerance) {
    return left !== null && right !== null && Math.abs(left - right) <= tolerance;
};

LayerFilter.roundColor = function (value) {
    return Math.round(Number(value) * 100) / 100;
};
