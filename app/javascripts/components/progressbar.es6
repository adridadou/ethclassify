class Progressbar {
  constructor(progressElement) {
    this.progressElement = progressElement;
  }

  startLoading() {
    this.progressElement.className = 'loading';  
  }

  finishLoading(){
      this.setProgress(100);
  }

  updateProgress(evt) {
    if (evt.lengthComputable) {
      var percentLoaded:Number = Math.round((evt.loaded / evt.total) * 100);
      if (percentLoaded < 100) {
        this.setProgress(percentLoaded);
      }
    }
  }

  setProgress(value:Number) {
    this.progressElement.style.width = value + '%';
    this.progressElement.textContent = value + '%';
  }

  errorHandler(evt) {
    console.error(evt.target.error.message);
  }
}