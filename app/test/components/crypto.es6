var should = chai.should();

describe('Crypto', () => {
  const ethCrypto = new EthCrypto();
  describe('Symmetric key crypto', () =>  {
    it('should be able to encrypt with a symmetric key and decrypt the message with the same key', done => {
      ethCrypto.generateSymKey().then(key => {
        var message = 'this is my message 68738798234&(/%*)(/ç()/%\nijewiofjweiof';
        ethCrypto.encryptWithSymKey(message,key).then(encryptedMessage => {
          ethCrypto.decryptWithSymKey(encryptedMessage,key).then(result => {
            expect(result).to.equal(message);
            done();
          })
        });
      });
    });
    it('should be able to encrypt with a symmetric key, export the key, import it and decrypt the message with the same key', done => {
      ethCrypto.generateSymKey().then(key => {
        var message = 'this is my message 68738798234&(/%*)(/ç()/%\nijewiofjweiof';
        ethCrypto.encryptWithSymKey(message,key).then(encryptedMessage => {
          ethCrypto.exportKey(key).then(strKey => {
            ethCrypto.importSymKey(strKey).then(importedKey => {
              ethCrypto.decryptWithSymKey(encryptedMessage,importedKey).then(result => {
                expect(result).to.equal(message);
                done();
              });
            });
          });
        });
      });
    });
  });

  describe('Asymmetric key crypto', () => {
    
    it('should be able to encrypt with a public key and decrypt the message with the private key', done => {
      ethCrypto.generateAsymKey().then((keypair) => {
        var message = 'this is my message 68738798234&(/%*)(/ç()/%\nijewiofjweiof';
        ethCrypto.encryptWithAsymKey(message,keypair.publicKey).then(encryptedMessage => {
          ethCrypto.decryptWithAsymKey(encryptedMessage,keypair.privateKey).then(result => {
            expect(result).to.equal(message);
            done();
          })
        });
      });
    });

    it('should be able to encrypt with a public key and decrypt the message with the private key with import export in the middle', done => {
      ethCrypto.generateAsymKey().then((keypair) => {
        Promise.all([
          ethCrypto.exportKey(keypair.publicKey),
          ethCrypto.exportKey(keypair.privateKey)
        ]).then(arr => {
          Promise.all([
            ethCrypto.importAsymPublicKey(arr[0]),
            ethCrypto.importAsymPrivateKey(arr[1])
          ]).then(arr => {
            var message = 'this is my message 68738798234&(/%*)(/ç()/%\nijewiofjweiof';
            ethCrypto.encryptWithAsymKey(message,arr[0]).then(encryptedMessage => {
              ethCrypto.decryptWithAsymKey(encryptedMessage,arr[1]).then(res => {
                expect(res).to.equal(message);
                done();
              })
            });
          });
        })
        
      });
    });

  });
});