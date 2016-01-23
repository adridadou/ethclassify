var reader, symKeyPromise;

function abortRead() {
  if(reader) {
    reader.abort();
  }
}

function initReader(progress) {
  reader = new FileReader();
  reader.onerror = errorHandler;
  reader.onprogress = updateProgress;

  reader.onloadstart = function(e) {
    document.getElementById('progressbar').className = 'loading';
  };

  reader.onload = function(e) {
    // Ensure that the progress bar displays 100% at the end.
    progress.style.width = '100%';
    progress.textContent = '100%';
    transitToStep2();
    message('wait for the key to be generated ...');
    symKeyPromise.then(encryptFile);
  }
}

function transitToStep2(){
  document.getElementById('progressbar').className='';
  document.getElementById('abort').className='';
  document.getElementById('message').className='';
  document.getElementById('dropzone').textContent='Document Ready!';
  document.getElementById('step2').className='step-active';
  var dropZone = document.getElementById('dropzone');
  dropZone.removeEventListener('dragover');
  dropZone.removeEventListener('drop');
}

function encryptFile(symKey) {
  message('encrypting file ...');
  var vector = crypto.getRandomValues(new Uint8Array(16));
  var encryptPromise = crypto.subtle.encrypt({name: "AES-CBC", iv: vector}, symKey, reader.result);

    encryptPromise.then(
        function(result){
          message('encryption done!');
          uploadFile(result);
        }, 
        function(e){
            message(e.message);
        }
    );

}

function processFile(file){
    var progress = document.querySelector('.percent');
    // Reset progress indicator on new file selection.
    progress.style.width = '0%';
    progress.textContent = '0%';

    initReader(progress);
    // Read in the image file as a binary string.
    reader.readAsArrayBuffer(file);
    message('reading file ...');
    symKeyPromise = generateSymKey();
    document.getElementById('abort').className='button-active';

}


function handleFileSelect(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    var files = evt.dataTransfer.files; // FileList object.
    processFile(files[0]);
}

function handleDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
}

function errorHandler(evt) {
    message(evt.target.error.message);
}

function encryptPart(evt) {
  var vector = crypto.getRandomValues(new Uint8Array(16)); 
}

function updateProgress(evt) {
    var progress = document.querySelector('.percent');
    // evt is an ProgressEvent.
    
    if (evt.lengthComputable) {
      var percentLoaded = Math.round((evt.loaded / evt.total) * 100);
      // Increase the progress bar length.
      if (percentLoaded < 100) {
        progress.style.width = percentLoaded + '%';
        progress.textContent = percentLoaded + '%';
      }
    }
}