import '@testing-library/jest-dom';

if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = HTMLDialogElement.prototype.showModal || function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = HTMLDialogElement.prototype.close || function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}
