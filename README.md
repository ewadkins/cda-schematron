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

**Ignored** tests are those that resulted in an error of some sort (eg. the test is invalid xpath and could not be parsed properly) and require manual inspection.
