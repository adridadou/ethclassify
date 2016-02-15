class EthereumManager {
	sync(smartContractCall) {
		return new Promise((resolve, reject) => {
			smartContractCall.then(tx => {
	        var filter = web3.eth.filter('latest');
	        filter.watch((error, result) => {
	            var receipt = web3.eth.getTransactionReceipt(tx);
	            // XXX should probably only wait max 2 events before failing XXX 
	            if (receipt && receipt.transactionHash == tx) {
	                filter.stopWatching();
	                deferred.resolve();
	            }

	            //TODO: handle error case

	        });
	    });
	}
}