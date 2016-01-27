function getDocumentDetails() {
	var docMgr = DocumentManager.deployed();
	var docId = document.getElementById('documentId').value;

	docMgr.getDocumentName.call(docId).then(function(name) {
		console.log('document name:' + name);
		document.getElementById('details').className = 'step-active';
		document.getElementById('documentName').textContent = name;
	});
}