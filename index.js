// Modules
var fetch = require('node-fetch');
var fs = require('fs');
var Promise = require("bluebird");
var js2xmlparser = require("js2xmlparser2");

// Settings
var fieldsToPull = ['first_name', 'last_name', 'email', 'company', 'twitter'];
var c_MAXNUMBERTOPUSH = 300;
var vUsername = 'USERNAME';
var vPassword = 'PASSWORD';
var vEventGuid = 'EVENT-GUID';
var vURL = "https://url.to.post.to/";
var vHeaders = {'Content-Type' : 'text/xml; charset=utf-8', 'SOAPAction' : 'https://soap.action/url'};
var endpoint = "http://pull.data.from.here/badges.json";
var authorization = "Token 123-456-789";
var soapReqP1 = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<soap:Header><AuthenticationSoapHeader xmlns="https://soap.action.url.com/">
<Username>${vUsername}</Username>
<Password>${vPassword}</Password>
</AuthenticationSoapHeader></soap:Header>
<soap:Body><PutRegistrationData xmlns="https://soap.action.url.com/">
<eventGuid>${vEventGuid}</eventGuid><data><![CDATA[
`;
var soapReqP2 = ']]></data></PutRegistrationData></soap:Body></soap:Envelope>';
var js2xmlOptions = {
	declaration: {
		include : false
	}
};

function convertBufferToJson(httpResponse) {
	var promise = new Promise(function(resolve, reject) {
		if(httpResponse && httpResponse.statusText === "OK"){
			resolve(httpResponse.json());
		} else {
			var date = new Date();
			reject("\n" + date + "\nProblem connecting to API.");
		}
	});
	return promise;
}

function filterFields(regList) {
	var newRegList = [];
	var promise = new Promise(function(resolve, reject) {
		if(regList.length > 0) {
			for(var i = 0, j = regList.length; i < j; i++){
				var person = {};
				var hasData = false;
				for(var propName in regList[i]) {
					if(regList[i].hasOwnProperty(propName)) {
						if(fieldsToPull.indexOf(propName) > -1) {
							person[propName] = regList[i][propName];
							hasData = true;
						}
					}
				}
				if(hasData) {
					newRegList.push(person);
				}
			}
			if(newRegList.length > 0) {
				resolve(newRegList);
			} else {
				var date = new Date();
				reject("\n" + date + "\nPulled attendees, but no data.");
			}
		} else {
			var date = new Date();
			reject("\n" + date + "\nZero attendees.");
		}
	});
	return promise;
}

function sizeRegList(regList) {
	var splitRegList = [];
	var promise = new Promise(function(resolve, reject) {
		for(var i = 0, j = regList.length; i < j; i += c_MAXNUMBERTOPUSH) {
			splitRegList.push(regList.slice(i, i + c_MAXNUMBERTOPUSH));
		}
		if(splitRegList.length > 0) {
			resolve(splitRegList);
		} else {
			var date = new Date();
			reject("\n" + date + "\nNo data in splitRegList");
		}
	});
	return promise;
}

function convertToXml(splitReg) {
	var xmlStrArr = [];
	var promise = new Promise(function(resolve, reject) {
		for(var i = 0, j = splitReg.length; i < j; i++) {
			var xmlFromJs = js2xmlparser("update", splitReg[i], js2xmlOptions);
			xmlStrArr.push(xmlFromJs);
		}
		if(xmlStrArr.length > 0) {
			resolve(xmlStrArr);
		} else {
			var date = new Date();
			reject("\n" + date + "\nXML String array length is zero");
		}
	});
	return promise;
}

function continuePush(xmlArr) {
	var promise = new Promise(function(resolve, reject) {
		if(xmlArr.length === 0) {
			var date = new Date();
			console.log(date + "\nPushed everything successfully!");
			return resolve("\n" + date + "\nSUCCESS!");
		}
		fetch(vURL, { method : "POST", headers : vHeaders, body : (soapReqP1 + '<updates>' + xmlArr[0] + '</updates>' + soapReqP2)})
			.then(function() {
				xmlArr.shift();
				resolve(continuePush(xmlArr));
			});
	});
	return promise;
}

function pushToEvent(xmlArr) {
	var promise = new Promise(function(resolve, reject) {
		fetch(vURL, { method : "POST", headers : vHeaders, body : (soapReqP1 + '<updates>' + xmlArr[0] + '</updates>' + soapReqP2)})
			.then(function(){
				xmlArr.shift();				
				if(xmlArr.length > 0){
					resolve(continuePush(xmlArr));
				} else {
					var date = new Date();
					resolve("\n" + date + "\nSUCCESS!");
				}		
			})
			.catch(function() {
				var date = new Date();
				reject("\n" + date + "\nProblem pushing data to event");
			});
	});
	return promise;
}

function logToFile(data) {
	var promise = new Promise(function(resolve, reject) {
		fs.appendFile('log.txt', data, function(error) {
			if(error) {
				var date = new Date();
				reject("\n" + date + "\n" + error);
			} else {
				resolve();
			}
		})
	});
	return promise;
}

function consoleLog(data) {
	var promise = new Promise(function(resolve, reject) {
		console.log(data);
		resolve(data);
	});
	return promise;
}

function startApplication() {
	fetch(endpoint, { method: "GET", headers: { Authorization : authorization }})
		.then(convertBufferToJson)
		.then(filterFields)
		.then(sizeRegList)
		.then(convertToXml)
		.then(pushToEvent)
		.then(logToFile)
		//.then(consoleLog)
		.then(function() {
			startApplication();
		})
		.catch(function(data) {
			var log = logToFile(data);
			log.then(startApplication);
		});
}

console.log('Starting Application...');
startApplication();