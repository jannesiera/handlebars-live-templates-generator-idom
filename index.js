'use strict';

const generateElementOpen = (node) => {
    return "elementOpenStart('" + node.tagName + "');" + generateElementAttributes(node.handlebarAttrs) + "elementOpenEnd(" + generateString(node.tagName) + ");";
}

/*

attr('class', function() {
    var values = [];
    values.push("green");
    if(context['allowInsults']) {
        values.push(" red");
    }
    return values.length > 0 ? values.reduce(function(sum, val) { return sum + val; }) : '';
}())
*/
const generateElementAttributes = (attributes) => {
    let attrs = "";
    attributes.forEach(attribute => {
        if(attribute.isHandlebars === true) {
            var context = generateContext(attribute.name);
            attrs +=
                generateOpenIf(context + '!== undefined') +
                    generateAttribute(context, generateAttributeValueFunc(attribute.value)) +
                generateCloseIf();
        } else {
            attrs += generateAttribute(generateString(attribute.name), generateAttributeValueFunc(attribute.value));
        }
    });
    return attrs;
}

const generateAttribute = (name, value) => {
    return "attr(" + name + "," + value + ");";
}

const generateAttributeValueFunc = (values) => {
    let func = "function() {";
    func += "var values = [];";
    values.forEach(node => {
        if(node.nodeName === '#text') {
            func += "values.push(" + generateString(node.value) + ");";
        } else if(node.nodeName === '#handlebars') {
            if(node.type === 'openIf') {
                // TODO check for closing tag in siblings, and throw exception if not found
                func += generateOpenIf(generateContext(node.value));
            } else if (node.type === 'closeIf') {
                func += generateCloseIf();
            } else {
                func += "values.push(" + generateContext(node.value) + ");";
            }
        }
    });
    func += "if(values.length === 1) { return values[0]; } if(values.length > 1) { return values.reduce(function(sum, val) { return sum + val; }) } return ''; }()";
    return func;
}

const generateIf = (condition, body) => {
    return "if(" + ") {" + body + "};";
}

const generateElementClose = (node) => {
    return "elementClose('" + node.tagName + "');";
}

const generateElement = (node) => {
    return generateElementOpen(node) + generateChildNodes(node) + generateElementClose(node);
}

const generateString = (value) => {
    return "'" + value + "'";
}

const generateContext = (value) => {
    var valueString = value.split('.')
        .map((val) => { return "['" + val + "']"; })
        .reduce((sum, val) => { return sum + val; });
    return "context" + valueString;
}

const generateText = (node) => {
    // Escapce newline characters and backticks
    return "text(`" + node.value.replace(/\r|\n/g, "\\n").replace(/\u0060/g, '\\`') + "`);";
}

const generateHandlebarsText = (node) => {
    // TODO might have to escape newline character like in generateText(node)
    return "text(" + generateContext(node.value) + ");";
}

const generateOpenIf = (condition) => {
    return "if(" + condition + ") {";
}

const generateCloseIf = () => {
    return "};";
}

const generateOpenEach = (value) => {
    // TODO throw runtime error if context[value] is not an array
    return generateContext(value) + ".forEach(function(value, index, array) { /*var context = deepCopy(context);*/ context['this'] = value; context['@index'] = index;";
}

const generateCloseEach = () => {
    return "});";
}

const generateChildNodes = (node) => {
    if(node.childNodes <= 0) return "";
    var code = "";
    node.childNodes.forEach((node) => {
        if(node.nodeName === '#comment') {
            return;
        }
        if(node.nodeName === '#text') {
            code += generateText(node);
        } else if(node.nodeName === '#handlebars') {
            if(node.type === 'openIf') {
                // TODO check for closing tag in siblings, and throw exception if not found
                code += generateOpenIf(generateContext(node.value));
            } else if (node.type === 'closeIf') {
                code += generateCloseIf();
            } else if(node.type === 'openEach') {
                code += generateOpenEach(node.value);
            } else if(node.type === 'closeEach') {
                code += generateCloseEach();
            } else {
                code += generateHandlebarsText(node);
            }
        } else {
            code += generateElement(node);
        }
    });
    return code;
}



exports.GenerateRenderFunction = (tree) => {
    return `
    import * as idom from 'incremental-dom';
    var elementOpen = idom.elementOpen;
    var elementClose = idom.elementClose;
    var text = idom.text;
    var attr = idom.attr;
    var elementOpenStart = idom.elementOpenStart;
    var elementOpenEnd = idom.elementOpenEnd;
    var attributes = idom.attributes;
    var applyProp = idom.applyProp;
    var symbols = idom.symbols;
    attributes.checked = attributes.className = attributes.disabled = attributes.value = applyProp;
    attributes.focus = function (el, name, value) {
        if(value) el.focus();
    }
    const applyDefault = attributes[symbols.default];
    attributes[symbols.default] = function (elem, name, value) {
    // Boolean false values should not set attributes at all.
    if (value === false) {
        return applyProp(elem, name, value);
    }

    // Work with properties defined on the prototype chain. This includes event
    // handlers that can be bound via properties.
    if (name in elem) {
        return applyProp(elem, name, value);
    }

    // Handle custom events.
    if (name.indexOf('on') === 0) {
        return applyEvent(elem, name.substring(2), name, value);
    }

    // Fallback to default IncrementalDOM behaviour.
    applyDefault(elem, name, value);
    };
    var deepCopy = function(source) {
    var copy = {};
    Object.getOwnPropertyNames(source).forEach(function(propKey) {  
        var desc = Object.getOwnPropertyDescriptor(source, propKey);
        Object.defineProperty(copy, propKey, desc);
        if (deep && typeof desc.value === 'object') {
          copy[propKey] = copyObject(source[propKey]);
        }
    });
    return copy;
    };` +
    "var idomRender = function render(context) {" + generateChildNodes(tree) + "}; var render = function(el, data) { idom.patch(el, idomRender, data); } export { render };";
};