contract('Document', function(accounts) {
  it("should set the owner as the caller", function(done) {
    testme();
    var account = accounts[0],
    ipfs = 'ipfsAddress';
    Document.new(ipfs).then(function(doc){
      doc.owner.call().then(function(result){
        assert.equal(account,result); 
        doc.document.call().then(function(result){
          assert.equal(ipfs,result);
          done();
        });
      });
    });
  });

  it("should request a document and get a request id", function(done){
    var ipfs = 'ipfsAddress';
    Document.new(ipfs).then(function(doc){
      doc.nbRequests().then(function(nbrequests){
        doc.requestDocument.call().then(function(requestId){
          assert.equal(parseInt(nbrequests) + 1,requestId)
          done();
        });  
      })
    });
  });

  it("should give the address of the requestee account", function(done){
    var ipfs = 'ipfsAddress',
    account = accounts[0];
    Document.new(ipfs).then(function(doc){
      doc.nbRequests().then(function(nbrequests){
        doc.requestDocument.call().then(function(requestId){
          doc.getRequestOwner.call(requestId).then(function(result){
            assert.equal(account,result);
            done();
          });
        });  
      })
    });
  })
});
