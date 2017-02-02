# cda-schematron
A javascript implementation of schematron testing for XML documents. This specifically resolves a need for a package that allows a quick, reliable install for validating HL7 clinical documents, such as C-CDA.

---

### Install
```
npm install cda-schematron
```
---

### Validating xml
```javascript
var validator = require('cda-schematron');

var xmlPath = 'someFile.xml';
var schematronPath = 'someFile.sch';

var fs = require('fs');
var xml = fs.readFileSync(xmlPath).toString();
var schematron = fs.readFileSync(schematronPath).toString();

var results = validator.validate(xml, schematron);
```
File paths can also be passed to the validator directly. The following lines all return the same results:
```javascript
var results = validator.validate(xml, schematronPath);
```
```javascript
var results = validator.validate(xmlPath, schematron);
```
```javascript
var results = validator.validate(xmlPath, schematronPath);
```

### Results
```results``` is an object containing arrays  ```errors```, ```warnings```, and ```ignoreds```.

**Errors** and **warnings** are reported as determined by the schematron and test descriptions.

**Ignored** tests are those that resulted in an exception while running (eg. the test is invalid xpath and could not be parsed properly) and require manual inspection.

### Options
The ```validate``` function takes in an object as an optional third argument, ```options```. The three fields that can be included in ```options``` are as follows:

**```includeWarnings```**: ```true``` or ```false```, this determines whether or not warnings should be tested and returned. Defaults to ```true```.

**```resourceDir```**: the path to a resource directory containing resource files (eg. voc.xml) which may be necessary for some schematron tests. Defaults to ```'./'```, the current directory.

**```xmlSnippetMaxLength```**: an integer, which is the maximum length of the ```xml``` field in validation results. Defaults to ```200```. Set to ```0``` for unlimited length.

### Cache
The validator uses a cache to store parsed schematrons, an intermediate data structure used to store revelant schematron information. This reduces the runtime of the validator when validating against the same schematron multiple times. You can clear the cache at any time with:
```javascript
validator.clearCache();
```
