function generateSymKey(){
	return crypto.subtle.generateKey({name: "AES-CBC", length: 128}, false, ["encrypt", "decrypt"])
	.catch(function(){
		message('error while generating AES-CBC key');
	});
}

