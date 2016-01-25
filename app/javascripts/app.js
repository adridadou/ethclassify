window.onload = function() {
  initFileAPI();
  initDropzone();
  initCrypto();
  initIpfs();
  initRequireJs();
  initWeb3();
  setTimeout(handleRequest,2000);
}

function message(msg) {
  document.getElementById('message').innerHTML = msg;
}
