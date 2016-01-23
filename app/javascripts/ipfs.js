function uploadFile(result) {
	ipfs.add(new Buffer(result), function(err, res) {
    	if(err || !res) return console.error(err);
    	console.log(res.Hash);
    	console.log(res.Name);

    	//create smart contract
    	
	});
}