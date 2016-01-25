contract Document {
	address public owner;
	string public document;
	uint public nbRequests;
    string public privateKey;
	mapping (uint => Request) requests;


	enum Status {OPEN,DONE,DENIED}
	struct Request {
		address owner;
		Status status;
	}

	function Document(string ipfs) {
        owner = msg.sender;
        document = ipfs;
    }

    function requestDocument() returns (uint nb){
    	nbRequests++;
    	var request = requests[nbRequests];
    	
    	request.status = Status.OPEN;
    	request.owner = msg.sender;

        return nbRequests;
    }

    function getRequestOwner(uint requestId) returns (address _owner) {
        if(owner == msg.sender){
            return requests[requestId].owner;
        }
        return 0x0;
    }
}
