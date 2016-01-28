var encoder = new TextEncoder(),
  decoder = new TextDecoder();

function generateSymKey(){
	return crypto.subtle.generateKey({name: "AES-CBC", length: 128}, true, ["encrypt", "decrypt"])
	.catch(function(){
		message('error while generating AES-CBC key');
	});
}

function generateAsymKey() {
    return crypto.subtle.generateKey({
    	name: "RSA-OAEP", 
    	modulusLength: 2048,
    	publicExponent: 
    	new Uint8Array([0x01, 0x00, 0x01]), hash: {name: "SHA-256"}}, true, ["encrypt", "decrypt"]
    );
}

function encryptWithSymKey(key, text) {
    return crypto.subtle.encrypt({name: "AES-CBC", iv: vector}, key, convertStringToArrayBufferView(text)).then(convertArrayBufferViewtoString);
}

function decryptWithSymKey(key, text) {
    return crypto.subtle.decrypt({name: "AES-CBC", iv: vector}, key, convertStringToArrayBufferView(text)).then(convertArrayBufferViewtoString);
}

function encryptWithAsymKey(publicKey, text) {
    return crypto.subtle.encrypt({name: "RSA-OAEP", iv: vector}, publicKey, convertStringToArrayBufferView(text)).then(convertArrayBufferViewtoString);
}

function decryptWithAsymKey(privateKey, text) {
    return crypto.subtle.decrypt({name: "RSA-OAEP", iv: vector}, privateKey, convertStringToArrayBufferView(text)).then(convertArrayBufferViewtoString);
}

function convertArrayBufferViewtoString(buf) {
  return String.fromCharCode.apply(null, new Uint16Array(buf));
}

function convertStringToArrayBufferView(str) {
  var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
  var bufView = new Uint16Array(buf);
  for (var i=0, strLen=str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

function exportKey(key) {
    return crypto.subtle.exportKey("jwk", key).then(function(result) {
        return JSON.stringify(result);
    });
}

function importAsymPublicKey(strKey) {
    var key = JSON.parse(strKey);
    return crypto.subtle.importKey("jwk", key, {
        name: "RSA-OAEP", 
        modulusLength: 2048, 
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]), 
        hash: {name: "SHA-256"}}, true, ["encrypt"]);
}

function importAsymPrivateKey(strKey) {
    var key = JSON.parse(strKey);
    return crypto.subtle.importKey("jwk", key, {
        name: "RSA-OAEP", 
        modulusLength: 2048, 
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]), 
        hash: {name: "SHA-256"}}, true, ["decrypt"]);
}

function importSymKey(strKey) {
    var key = JSON.parse(strKey);
    return crypto.subtle.importKey("jwk", key, {
        name: "AES-CBC", 
        modulusLength: 128, 
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]), 
        hash: {name: "SHA-256"}}, true, ["encrypt", "decrypt"]);
}
