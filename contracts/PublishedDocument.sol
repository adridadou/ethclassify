contract PublishedDocument {
	address publisher;
	string document;

	function PublishedDocument(string ipfsDocument) {
        publisher = msg.sender;
        document = ipfsDocument;
    }

    function request() {
    	new DocumentRequest(msg.sender);
    }
}
