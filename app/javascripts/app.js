window.onload = function() {
  initFileAPI();
  initDropzone();
  initCrypto();
  initIpfs();
  initRequireJs();
  initWeb3();
}

function message(msg) {
  document.getElementById('message').innerHTML = msg;
}
