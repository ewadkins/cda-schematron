// jshint node:true
// jshint shadow:true
module.exports = testAssertion;

function testAssertion(test, selected, select, xmlDoc, resourceDir, xmlSnippetMaxLength) {
    let results = [];
    
    for (let i = 0; i < selected.length; i++) {
        try {
            let result = select('boolean(' + test + ')', selected[i]);
            let lineNumber = null;
            let xmlSnippet = null;
            if (selected[i].lineNumber) {
                lineNumber = selected[i].lineNumber;
                xmlSnippet = selected[i].toString();
            }
            let maxLength = (xmlSnippetMaxLength || 1e308);
            if (xmlSnippet && xmlSnippet.length > maxLength) {
                xmlSnippet = xmlSnippet.slice(0, maxLength) + '...';
            }
            results.push({ result: result, line: lineNumber, path: getXPath(selected[i]), xml: xmlSnippet });
        }
        catch (err) {
            return { ignored: true, errorMessage: err.message };
        }
    }
    
    for (let i = 0; i < results.length; i++) {
        if (results[i].result !== true && results[i].result !== false) {
            return { ignored: true, errorMessage: 'Test returned non-boolean result' };
        }
    }
    return results;
}

function getXPath(node, path) {    
    let top = !path ? true : false;
    path = path || [];
    if (node.parentNode) {
        path = getXPath(node.parentNode, path);
    }

    let count = 1;
    if (node.previousSibling) {
        let sibling = node.previousSibling;
        do {
            if (sibling.nodeType === 1 && sibling.nodeName === node.nodeName) {
                count++;
            }
            sibling = sibling.previousSibling;
        } while (sibling);
        if (count === 1) {
            count = null;
        }
    }
    else if (node.nextSibling) {
        let sibling = node.nextSibling;
        do {
            if (sibling.nodeType === 1 && sibling.nodeName === node.nodeName) {
                count = 1;
                sibling = null;
            } else {
                count = null;
                sibling = sibling.previousSibling;
            }
        } while (sibling);
    }

    if (node.nodeType === 1) {
        path.push(node.nodeName + ('[' + (count || 1) + ']'));
    }
    return top ? '/' + path.join('/') : path;
}