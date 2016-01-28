function requestAccess() {
	generateAsymKey().then(handleAccessRequest);
}

function handleAccessRequest(key){
	var docMgr = DocumentManager.deployed();
	var documentId = parseInt(document.getElementById('documentId').value);
	exportKey(key.publicKey).then(function(strPublicKey){
		return docMgr.requestDocument(documentId,strPublicKey, 0, {from:account}).then(function(tx){
	        var filter = web3.eth.filter('latest');
	        filter.watch(function(error, result) {
	            var receipt = web3.eth.getTransactionReceipt(tx);
	            // XXX should probably only wait max 2 events before failing XXX 
	            if (receipt && receipt.transactionHash == tx) {
	                docMgr.getLastRequestId.call(documentId).then(function(requestId){
	                  var requests = localStorage.getItem('requests');
	                  if(!requests || requests === '') {
	                  	requests = [];
	                  }else {
	                  	requests = JSON.parse(requests);
	                  }
	                  exportKey(key.privateKey).then(function(strPrivateKey){
							requests.push({
			                  	documentId: documentId,
			                  	requestId: requestId,
			                  	privateKey: strPrivateKey,
			                  	publicKey: strPublicKey
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
		var html = '<table class="requestTable"><tr><th>document id</th><th>request id</th></tr>';
		requests.forEach(function(request, index) {
			html = html + '<tr onclick="openRequest(' + index + ')"><td>' + request.documentId + '</td><td>' + request.requestId + '</td></tr>';
		});

		html = html + '</table>';
		document.getElementById('requests').innerHTML = html;
	}
}

function handleRequests(){
	DocumentManager.deployed().nbDocuments.call().then(function(nbDocuments) {
		for(var i = 0; i < nbDocuments; i++) {
			handleOpenRequests(i + 1);
		}

		setTimeout(handleRequests,2000);
	});
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
	var request = JSON.parse(localStorage.getItem('requests'))[index];
	var documentId = request.documentId;
	var requestId = request.requestId 
	var strPrivateKey = request.privateKey;
	var strPublicKey = request.publicKey;
	var docMgr = DocumentManager.deployed();
	docMgr.getEncryptedKeyFromRequest.call(documentId, requestId).then(function(strKey) {
		if(strKey === '') {
			message('the request is either open or denied!');
		}else {
			console.log('symmetric key:' + strKey);
			docMgr.getDocumentHash.call(documentId).then(function(hash) {

				importAsymPrivateKey(strPrivateKey).then(function(privateKey){
		        	importSymKey(strKey).then(function(symKey) {
		        		readFile(hash, function(res) {
					        // Returned as a string
					        console.log(res);
					        var txt = res + '';
					        console.log(txt);
						    decryptWithSymKey(symKey, txt).then(
						        function(result){
						          message('decryption done!');
								  var docResult = document.getElementById('docResult');
								  docResult.className = 'step-active';
						          docResult.value = result;
						        },
						        function(err) {
						        	console.log('error while decrypting ' + err.name);
						        }
						    );
						});
		        	});
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
			var symKey = localStorage.getItem(hash);
			if(symKey !== null) {
				//importAsymPublicKey(key).then(function(publicKey) {
					//console.log(symKey);
					//encryptWithAsymKey(publicKey, symKey).then(function(encKey) {
						console.log('access granted!');
						docMgr.grantAccess(documentId,requestId,symKey, 0,{from: account}).then(function(tx) {
							alert('you just granted access to document ' + documentId + ' request ' + requestId);
						});
					//},function(err){
					//	console.log('error while encrypting the symmetric key');
					//	console.log(err.name);
					//});
				//},
				//function(err){
				//	console.log(err.name);
				//});
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