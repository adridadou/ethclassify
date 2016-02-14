class Ipfs {
	constructor() {
		if(window.ipfsAPI){
	        this.ipfs = window.ipfsAPI('localhost', '5001');    
	    }else {
	        alert('IPFS not available!');
	    }
	}
	uploadFile(result, callback) {	
		this.ipfs.add(new this.ipfs.Buffer(result), (err, res) => {
	    	if(err || !res) return console.error(err);
	    	callback(res.Hash);
		});
	}

	readFile(hash, callback) {
		//TODO: create promise API
		this.ipfs.cat(hash, (err, res) => {
		    if(err || !res) return console.error(err)
		    callback(res);
		});	
	}
}