contract DocumentManager {
	
    mapping (uint => Document) documents;
    uint public nbDocuments;
    address public owner;

	enum Status {OPEN,DONE,DENIED}

    struct Document{
        address owner;
        string document;
        string name;
        uint nbRequests;
        string privateKey;
        mapping (uint => Request) requests;    
    }

	struct Request {
		address owner;
		Status status;
        string key;
	}

	function DocumentManager() {
        owner = msg.sender;
    }

    function grantAccess(uint documentId, uint requestId, string encryptedKey) {
        if(owner == msg.sender) {
            documents[documentId].requests[requestId].status = Status.DONE;
            documents[documentId].requests[requestId].key = encryptedKey;
        }
    }

    function denyAccess(uint documentId, uint requestId, string encryptedKey) {
        if(owner == msg.sender) {
            documents[documentId].requests[requestId].status = Status.DENIED;
        }
    }

    function requestDocument(uint documentId, string publicKey) returns (uint nb){
    	documents[documentId].nbRequests++;
    	var request = documents[documentId].requests[documents[documentId].nbRequests];
    	
    	request.status = Status.OPEN;
    	request.owner = msg.sender;
        request.key = publicKey;

        return documents[documentId].nbRequests;
    }

}
