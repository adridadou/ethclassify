

'use strict';

var should = chai.should();

describe('Crypto', function () {
  var ethCrypto = new EthCrypto();
  describe('Symmetric key crypto', function () {
    it('should be able to encrypt with a symmetric key and decrypt the message with the same key', function (done) {
      ethCrypto.generateSymKey().then(function (key) {
        var message = 'this is my message 68738798234&(/%*)(/ç()/%\nijewiofjweiof';
        ethCrypto.encryptWithSymKey(message, key).then(function (encryptedMessage) {
          ethCrypto.decryptWithSymKey(encryptedMessage, key).then(function (result) {
            expect(result).to.equal(message);
            done();
          });
        });
      });
    });
    it('should be able to encrypt with a symmetric key, export the key, import it and decrypt the message with the same key', function (done) {
      ethCrypto.generateSymKey().then(function (key) {
        var message = 'this is my message 68738798234&(/%*)(/ç()/%\nijewiofjweiof';
        ethCrypto.encryptWithSymKey(message, key).then(function (encryptedMessage) {
          ethCrypto.exportKey(key).then(function (strKey) {
            ethCrypto.importSymKey(strKey).then(function (importedKey) {
              ethCrypto.decryptWithSymKey(encryptedMessage, importedKey).then(function (result) {
                expect(result).to.equal(message);
                done();
              });
            });
          });
        });
      });
    });
  });

  describe('Asymmetric key crypto', function () {

    it('should be able to encrypt with a public key and decrypt the message with the private key', function (done) {
      ethCrypto.generateAsymKey().then(function (keypair) {
        var message = 'this is my message 68738798234&(/%*)(/ç()/%\nijewiofjweiof';
        ethCrypto.encryptWithAsymKey(message, keypair.publicKey).then(function (encryptedMessage) {
          ethCrypto.decryptWithAsymKey(encryptedMessage, keypair.privateKey).then(function (result) {
            expect(result).to.equal(message);
            done();
          });
        });
      });
    });

    it('should be able to encrypt with a public key and decrypt the message with the private key with import export in the middle', function (done) {
      ethCrypto.generateAsymKey().then(function (keypair) {
        Promise.all([ethCrypto.exportKey(keypair.publicKey), ethCrypto.exportKey(keypair.privateKey)]).then(function (arr) {
          Promise.all([ethCrypto.importAsymPublicKey(arr[0]), ethCrypto.importAsymPrivateKey(arr[1])]).then(function (arr) {
            var message = 'this is my message 68738798234&(/%*)(/ç()/%\nijewiofjweiof';
            ethCrypto.encryptWithAsymKey(message, arr[0]).then(function (encryptedMessage) {
              ethCrypto.decryptWithAsymKey(encryptedMessage, arr[1]).then(function (res) {
                expect(res).to.equal(message);
                done();
              });
            });
          });
        });
      });
    });
  });
});