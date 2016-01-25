function uploadFile(result, callback) {
	ipfs.add(new Buffer(result), function(err, res) {
    	if(err || !res) return console.error(err);
    	callback(res.Hash);
	});
}