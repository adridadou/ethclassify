
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

function encryptSymKey(publicKey, key) {
    var vector = crypto.getRandomValues(new Uint8Array(16));
    return crypto.subtle.encrypt({name: "RSA-OAEP", iv: vector}, publicKey, convertStringToArrayBufferView(key)).then(
        function(result){
            return convertArrayBufferViewtoString(new Uint8Array(result));
        }
    );
}

function convertArrayBufferViewtoString(buffer)
{
    var str = "";
    for (var iii = 0; iii < buffer.byteLength; iii++) 
    {
        str += String.fromCharCode(buffer[iii]);
    }

    return str;
}

function convertStringToArrayBufferView(str)
{
    var bytes = new Uint8Array(str.length);
    for (var iii = 0; iii < str.length; iii++) 
    {
        bytes[iii] = str.charCodeAt(iii);
    }

    return bytes;
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
