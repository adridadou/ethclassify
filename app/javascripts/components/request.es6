class RequestManager {
	constructor(crypto:EthCrypto, documentManager: DocumentManager, ethManager:EthereumManager) {
		this.documentManager = documentManager;
		this.crypt = crypto;
		this.ethManager = ethManager;
	}

	requestAccess() {
		this.crypto.generateAsymKey().then(this.handleAccessRequest);
	}

	handleAccessRequest(key, documentId:Number){
		this.crypto.exportKey(key.publicKey).then(strPublicKey => {
			return this.ethManager.sync(this.documentManager.requestDocument(documentId,strPublicKey, 0, {from:account})).then(tx => {
                docMgr.getLastRequestId.call(documentId).then(requestId => {
                  var requests = localStorage.getItem('requests');
                  if(!requests || requests === '') {
                  	requests = [];
                  }else {
                  	requests = JSON.parse(requests);
                  }
                  this.crypto.exportKey(key.privateKey).then(strPrivateKey => {
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
		    });
		});
	}

	listRequests() {
		var requests = JSON.parse(localStorage.getItem('requests'));
		if(requests) {
			var html = '<table class="requestTable"><tr><th>document id</th><th>request id</th></tr>';
			requests.forEach((request, index) => {
				html = html + '<tr onclick="openRequest(' + index + ')"><td>' + request.documentId + '</td><td>' + request.requestId + '</td></tr>';
			});

			html = html + '</table>';
			document.getElementById('requests').innerHTML = html;
		}
	}

	handleRequests(){
		DocumentManager.deployed().nbDocuments.call().then(nbDocuments => {
			for(var i = 0; i < nbDocuments; i++) {
				this.handleOpenRequests(i + 1);
			}

			setTimeout(this.handleRequests,2000);
		});
	}

	handleOpenRequests(documentId) {
		this.documentManager.getLastRequestId.call(documentId).then(lastRequestId => {
			//promise recursion
			this.handleRequest(documentId, lastRequestId).then(()  => {
				return this.handleRequest(documentId, lastRequestId - 1);
			});
		});
	}

	openRequest(index) {
		var request = JSON.parse(localStorage.getItem('requests'))[index];
		var documentId = request.documentId;
		var requestId = request.requestId 
		var strPrivateKey = request.privateKey;
		var strPublicKey = request.publicKey;
		var docMgr = this.documentManager;
		docMgr.getEncryptedKeyFromRequest.call(documentId, requestId).then(strKey => {
			docMgr.getDocumentHash.call(documentId).then(hash => {
				this.crypto.importAsymPrivateKey(strPrivateKey).then(privateKey => {
		        	this.crypto.importSymKey(strKey).then(symKey => {
		        		readFile(hash, res => {
					        // Returned as a string
					        var txt = res + '';
						    decryptWithSymKey(symKey, txt).then(
						        result => {
								  var docResult = document.getElementById('docResult');
								  docResult.className = 'step-active';
						          docResult.value = result;
						        }
						    );
						});
		        	});
				});
			});
		});
	}

	handleRequest(documentId, requestId) {
		if(requestId < 0) return null;
		var docMgr = DocumentManager.deployed();
		return docMgr.getOpenRequestPublicKey.call(documentId, requestId).then(key => {
			if(key && key !== '') {
				//check if he has access
				return docMgr.getDocument.call(documentId, requestId).then(hash => {
					return checkAccess(documentId,requestId, hash, key).then(() => {
						return handleRequest(documentId, requestId - 1);
					});
				});
			}
		})
	}

	checkAccess(documentId, requestId, hash, key) {
		var docMgr = this.documentManager;
		return docMgr.getRequestOwner.call(documentId, requestId).then(owner => {
			if(this.hasAccess(owner)) {
				var symKey = localStorage.getItem(hash);
				if(symKey !== null) {
					this.crypto.importAsymPublicKey(key).then(publicKey =>  {
						this.crypto.encryptWithAsymKey(publicKey, symKey)
							.then(encKey => this.documentManager.grantAccess(documentId,requestId,encKey, 0,{from: account}));
						
					});
				}
			}else {
				console.log('access denied!');
				docMgr.denyAccess(documentId,requestId, 0,{from: account});
			}
		})
	}

	hasAccess(account) {
		return true;
	}
}