
class EthFileReader {
  constructor(progressbar:Progressbar, ethCrypto:EthCrypto, documentManager:DocumentManager,account, ipfs:Ipfs) {
    if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
        alert("File API is not supported");
    }else {
      this.reader = new FileReader();
      this.reader.onerror = progressbar.errorHandler;
      this.reader.onprogress = evt => progressbar.updateProgress(evt);
      this.reader.onloadstart = e => this.onStart(e);
      this.reader.onload = e => this.onFinish(e);

      this.progressbar = progressbar;
      this.crypto = ethCrypto;
      this.documentManager = documentManager;
      this.account = account;
      this.ipfs = ipfs;
    }
  }

  onStart() {
    this.progressbar.startLoading();
    this.symKeyPromise = this.crypto.generateSymKey();
  }

  onFinish() {
    // Ensure that the progress bar displays 100% at the end.
      this.progressbar.finishLoading();
      this.symKeyPromise.then(key => this.encryptFile(key));
  }

  abortRead() {
    this.reader.abort();
  }

  processFile(files){
    this.progressbar.setProgress(0);
    this.reader.readAsBinaryString(files[0]);
    this.symKeyPromise = this.crypto.generateSymKey();
    this.fileName = files[0].name;
  }

  encryptFile(symKey) {
    this.crypto.encryptWithSymKey(this.reader.result,symKey).then( result => this.ipfs.uploadFile(result, hash => this.publishFile(hash,symKey)));
  }

  publishFile(hash, symKey) {
    this.crypto.exportKey(symKey).then(value => localStorage.setItem(hash, value));

    this.documentManager.newDocument(hash,this.fileName, 0,{from: this.account}).then(tx => {
      var filter = web3.eth.filter('latest');
      filter.watch((error, result) => {
          var receipt = web3.eth.getTransactionReceipt(tx);
          // XXX should probably only wait max 2 events before failing XXX 
          if (receipt && receipt.transactionHash == tx) {
              this.documentManager.nbDocuments.call().then(docId => {
                //TODO: remove DOM dependency
                document.getElementById('documentId').textContent = 'Done! your document id is: ' + docId;
              });
              filter.stopWatching();
          }
        });
      });
  }
}