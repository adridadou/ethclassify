class Dropzone {

  constructor(element, selectCallback) {
    this.element = element;
    this.selectCallback = selectCallback;
    this.handleDragOver = this.handleDragOver.bind(this);
    this.handleFileSelect = this.handleFileSelect.bind(this);
    if(element) {
      element.addEventListener('dragover', this.handleDragOver, false);
      element.addEventListener('drop', this.handleFileSelect, false);
    }
  }

  handleFileSelect(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    this.selectCallback(evt.dataTransfer.files);
  }

  handleDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
  }

  errorHandler(evt) {
    console.error(evt.target.error.message);
  }
}