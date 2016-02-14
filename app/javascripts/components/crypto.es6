class EthCrypto {

    constructor() {
        this.symAlgo = 'AES-CBC';
        this.asymAlgo = 'RSA-OAEP';

        this.crypto = window.crypto || window.msCrypto;
        this.vector = new Uint8Array(16);
        for(var i = 0 ; i < 16 ; i++) {
            this.vector[i] = i;
        }
        if(!crypto.subtle) {
            alert('Crypto API is not available!');
        }
    }

    generateSymKey(){
        return this.crypto.subtle.generateKey({name: this.symAlgo, length: 128}, true, ["encrypt", "decrypt"]).catch(() => {
            console.error('error while generating AES-CBC key');
            console.error(arguments);
        });
    }

    generateAsymKey() {
        return this.crypto.subtle.generateKey({
            name: this.asymAlgo, 
            modulusLength: 2048,
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]), 
            hash: {name: "SHA-256"}
        }, true, ["encrypt", "decrypt"]);
    }

    encryptWithSymKey(text:String,key) {
        return this.crypto.subtle.encrypt({name: this.symAlgo, iv: this.vector}, key, this.str2buff(text)).then(this.buff2str);
    }

    decryptWithSymKey(text:String,key) {
        return this.crypto.subtle.decrypt({name: this.symAlgo, iv: this.vector}, key, this.str2buff(text)).then(this.buff2str);
    }

    encryptWithAsymKey(text:String, publicKey) {
        return this.crypto.subtle.encrypt({name: this.asymAlgo, iv: this.vector}, publicKey, this.str2buff(text)).then(this.buff2str);
    }

    decryptWithAsymKey(text:String, privateKey) {
        return this.crypto.subtle.decrypt({name: this.asymAlgo, iv: this.vector}, privateKey, this.str2buff(text)).then(this.buff2str);
    }

    buff2str(buf) {
      return String.fromCharCode.apply(null, new Uint16Array(buf));
    }

    str2buff(str:String) {
      var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
      var bufView = new Uint16Array(buf);
      for (var i=0, strLen=str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
      }
      return buf;
    }

    exportKey(key) {
        return crypto.subtle.exportKey("jwk", key).then(function(result) {
            return JSON.stringify(result);
        });
    }

    importAsymPublicKey(strKey) {
        var key = JSON.parse(strKey);
        return crypto.subtle.importKey("jwk", key, {
            name: this.asymAlgo, 
            modulusLength: 2048, 
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]), 
            hash: {name: "SHA-256"}}, true, ["encrypt"]);
    }

    importAsymPrivateKey(strKey) {
        var key = JSON.parse(strKey);
        return crypto.subtle.importKey("jwk", key, {
            name: this.asymAlgo, 
            modulusLength: 2048, 
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]), 
            hash: {name: "SHA-256"}}, true, ["decrypt"]);
    }

    importSymKey(strKey) {
        var key = JSON.parse(strKey);
        return crypto.subtle.importKey("jwk", key, {
            name: this.symAlgo, 
            modulusLength: 128, 
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]), 
            hash: {name: "SHA-256"}}, true, ["encrypt", "decrypt"]);
    }
} // no semicolon!