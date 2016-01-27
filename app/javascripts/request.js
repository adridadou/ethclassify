function requestAccess() {
	generateAsymKey().then(handleAccessRequest);
}

function handleAccessRequest(key){
	var docMgr = DocumentManager.deployed();
	var documentId = parseInt(document.getElementById('documentId').value);
	exportKey(key.publicKey).then(function(strPublicKey){
		return docMgr.requestDocument(documentId,strPublicKey, 0, {from:account}).then(function(tx){
			console.log('transaction sent!' + tx);
	        var filter = web3.eth.filter('latest');
	        filter.watch(function(error, result) {
	            var receipt = web3.eth.getTransactionReceipt(tx);
	            // XXX should probably only wait max 2 events before failing XXX 
	            if (receipt && receipt.transactionHash == tx) {
	                docMgr.requestDocument.call(documentId, strPublicKey).then(function(requestId){
	                  var requests = localStorage.getItem('requests');
	                  if(!requests || requests === '') {
	                  	requests = [];
	                  }else {
	                  	requests = JSON.parse(requests);
	                  }
	                  exportKey(key.privateKey).then(function(strPrivateKey){
						requests.push({
		                  	documentId: documentId,
		                  	requestId: requestId - 1,
		                  	privateKey: strPrivateKey
	                  	});
	                	localStorage.setItem('requests', JSON.stringify(requests));
	                	location.reload();
	                  });
	                });
	                
	                filter.stopWatching();
	            }
	        });
	    });
	});
}

function listRequests() {
	var requests = JSON.parse(localStorage.getItem('requests'));
	if(requests) {
		var html = '<table class="requestTable"><tr><th>document id</th><th>request id</th><th>status</th></tr>';
		requests.forEach(function(request, index) {
			html = html + '<tr onclick="openRequest(' + index + ')"><td>' + request.documentId + '</td><td>' + request.requestId + '</td><td>unknown</td></tr>';
		});

		html = html + '</table>';
		console.log(html);
		document.getElementById('requests').innerHTML = html;
	}
}

function handleRequests(){
	console.log('handling new requests');
	for(var i = 1; i < 3; i++) {
		handleOpenRequests(i);
	}

	setTimeout(handleRequests,2000);
}

function handleOpenRequests(documentId) {
	var docMgr = DocumentManager.deployed();
	docMgr.getLastRequestId.call(documentId).then(function(lastRequestId) {
		//promise recursion
		handleRequest(documentId, lastRequestId).then(function() {
			return handleRequest(documentId, lastRequestId - 1);
		});
	});
}

function openRequest(index) {
	console.log('try to open the document');
	var request = JSON.parse(localStorage.getItem('requests'))[index];
	var documentId = request.documentId;
	var requestId = request.requestId 
	var strPrivateKey = request.privateKey;
	var docMgr = DocumentManager.deployed();
	docMgr.getEncryptedKeyFromRequest.call(documentId, requestId).then(function(key) {
		if(key === '') {
			message('the request is either open or denied!');
		}else {
			var vector = crypto.getRandomValues(new Uint8Array(16));
			docMgr.getDocumentHash.call(documentId).then(function(hash) {
				var strKey = localStorage.getItem(hash);
				importAsymPrivateKey(strPrivateKey).then(function(privateKey){
					
					crypto.subtle.decrypt({name: "RSA-OAEP", iv: vector}, privateKey, convertStringToArrayBufferView(key)).then(
				        function(result){
				        	console.log('import sym key');
				        	importSymKey(convertArrayBufferViewtoString(new Uint8Array(result))).then(function(symKey) {
				        		ipfs.cat(hash, function(err, res) {
								    if(err || !res) return console.error(err)
								    if(res.readable) {
								        // Returned as a stream
								        var decryptPromise = crypto.subtle.decrypt({name: "AES-CBC", iv: vector}, symKey, reader.result);

									    decryptPromise.then(
									        function(result){
									          message('decryption done!');
									          console.log(result);
									        }
									    );
								    }
								})
				        	});
				        },
				        function(e){
				            message('error:' + e.name);
				        }
				    );
				});
			});
			
		}
	});
}

function handleRequest(documentId, requestId) {
	if(requestId < 0) return null;
	var docMgr = DocumentManager.deployed();
	return docMgr.getOpenRequestPublicKey.call(documentId, requestId).then(function(key) {
		if(key && key !== '') {
			//check if he has access
			return docMgr.getDocument.call(documentId, requestId).then(function(hash){
				return checkAccess(documentId,requestId, hash, key).then(function(){
					return handleRequest(documentId, requestId - 1);
				});
			});
		}
	})
}

function checkAccess(documentId, requestId, hash, key) {
	console.log('check access');
	var docMgr = DocumentManager.deployed();
	return docMgr.getRequestOwner.call(documentId, requestId).then(function(owner){
		if(hasAccess(owner)) {
			//TODO: encrypt key with publicKey, not hash!!
			var symKey = localStorage.getItem(hash);
			console.log('encrypt the sym key!' + symKey + ' for hash ' + hash);
			if(symKey !== null) {
				importAsymPublicKey(key).then(function(publicKey) {
					encryptSymKey(publicKey, symKey).then(function(encKey) {
						console.log('access granted!');
						docMgr.grantAccess(documentId,requestId,encKey, 0,{from: account});
					});
				});
			}
		}else {
			console.log('access denied!');
			docMgr.denyAccess(documentId,requestId, 0,{from: account});
		}
	})
}

function hasAccess(account) {
	return true;
}