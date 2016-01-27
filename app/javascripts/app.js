window.onload = function() {
  initFileAPI();
  initDropzone();
  initCrypto();
  initIpfs();
  initRequireJs();
  initWeb3();
  setTimeout(handleRequests,1000);
}

function message(msg) {
  document.getElementById('message').innerHTML = msg;
}
