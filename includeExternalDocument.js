// jshint node:true
// jshint shadow:true
module.exports = modifyTest;

const fs = require('fs');
const xpath = require('xpath');
const dom = require('@xmldom/xmldom').DOMParser;
const path_module = require('path');

let loadedExternalDocuments = Object.create({});

function modifyTest(test, resourceDir) {
    
    let matches = /=document\((\'[-_.A-Za-z0-9]+\'|\"[-_.A-Za-z0-9]+\")\)/.exec(test);
    while (matches) {
        
        // String processing to select the non-regular predicate expression
        let equalInd = test.indexOf(matches[0]);
        let start = equalInd;
        let bracketDepth = 0;
        for (let i = equalInd; i >= 0; i--) {
            if (!bracketDepth && (test[i] === '[' || test[i] === ' ')) {
                start = i + 1;
                break;
            }
            if (test[i] === ']') {
                bracketDepth++;
            }
            else if (test[i] === '[') {
                bracketDepth--;
            }
        }
        
        let end = test.length;
        bracketDepth = 0;
        for (let i = start + matches[0].length; i < test.length; i++) {
            if (!bracketDepth && (test[i] === ']' || test[i] === ' ')) {
                end = i;
                break;
            }
            if (test[i] === '[') {
                bracketDepth++;
            }
            else if (test[i] === ']') {
                bracketDepth--;
            }
        }
        
        let predicate = test.slice(start, end);
                
        // Load external doc (load from "cache" if already loaded)
        let filepath = matches[1].slice(1, -1);
        let externalDoc;
        if (!loadedExternalDocuments[filepath]) {
            let externalXml = null;
            try {
                externalXml = fs.readFileSync(path_module.join(resourceDir, filepath), 'utf-8').toString();
            }
            catch (err) {
                throw new Error('No such file \'' + filepath + '\'');
            }
            externalDoc = new dom().parseFromString(externalXml);
            loadedExternalDocuments[filepath] = externalDoc;
        }
        else {
            externalDoc = loadedExternalDocuments[filepath];
        }
        
        let externalXpath = test.slice(equalInd + matches[0].length, end);
                
        // Extract namespaces
        let defaultNamespaceKey = /([^(<>.\/)]+):[^(<>.\/)]+/.exec(externalXpath)[1];
        let externalNamespaceMap = externalDoc.lastChild._nsMap;
        let namespaceMap = {};
        for (let key in externalNamespaceMap) {
            if (externalNamespaceMap.hasOwnProperty(key)) {
                if (key) {
                    namespaceMap[key] = externalNamespaceMap[key];
                }
            }
        }
        namespaceMap[defaultNamespaceKey] = externalNamespaceMap[''];
        
        let externalSelect = xpath.useNamespaces(namespaceMap);
        
        // Create new predicate from extract values
        let values = [];
        let externalResults = externalSelect(externalXpath, externalDoc);
        for (let i = 0; i < externalResults.length; i++) {
            values.push(externalResults[i].value);
        }
        let lhv = predicate.slice(0, predicate.indexOf('=document('));
        let newPredicate = '(';
        for (let i = 0; i < values.length; i++) {
            newPredicate += lhv + '=\'' + values[i] + '\'';
            if (i < values.length - 1) {
                newPredicate += ' or ';
            }
        }
        newPredicate += ')';
        
        // Replace test
        test = test.slice(0, start) + newPredicate + test.slice(end);
        
        matches = /@[^\[\]]+=document\((\'[-_.A-Za-z0-9]+\'|\"[-_.A-Za-z0-9]+\")\)/.exec(test);
    }
    
    return test;
}