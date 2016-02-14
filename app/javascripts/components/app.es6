var Buffer

class App {
	constructor(accounts) {
		this.crypto = new EthCrypto();
		this.progressbar = new Progressbar(document.getElementById('progressbar'));
		this.documentManager = DocumentManager.deployed();
		this.ipfs = new Ipfs();
		this.file = new EthFileReader(this.progressbar,this.crypto,this.documentManager,accounts[0], this.ipfs);
		this.dropzone = new Dropzone(document.getElementById('dropzone'), files => this.file.processFile(files));
		this.request = new RequestManager(this.documentManager,this.crypto);
	}
}


window.onload = () => {

	requirejs.config({
        baseUrl: './',

        paths: {
            app: '../app'
        }
	});

    // Start the main app logic.
    requirejs(['buffer'],
       buffer => {
            Buffer = buffer.Buffer;
    });

    web3.eth.getAccounts((err, accs) => {
    if (err != null) {
      message("There was an error fetching your accounts.");
      return;
    }

    if (accs.length == 0) {
      message("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
      return;
    }

    var app = new App(accs);
  });
}