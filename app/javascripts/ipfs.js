function uploadFile(result, callback) {	
	ipfs.add(new ipfs.Buffer(result), function(err, res) {
    	if(err || !res) return console.error(err);
    	callback(res.Hash);
	});
}

function showFileIn(hash, documentId) {
	var elem = document.getElementById(documentId);
	readFile(hash,function(res) {
		elem.textContent = res;
	});
}

function readFile(hash, callback) {
	ipfs.cat(hash, function(err, res) {
	    if(err || !res) return console.error(err)
	    callback(res);
	});	
}