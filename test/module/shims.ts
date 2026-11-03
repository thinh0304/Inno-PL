// What jsdom lacks and the kit's elements use. Import first, before any screen.
class NoResize { observe() {} unobserve() {} disconnect() {} }
globalThis.ResizeObserver ??= NoResize as unknown as typeof ResizeObserver;
HTMLElement.prototype.showPopover ??= function (this: HTMLElement) { this.dataset.shown = 'true'; };
HTMLElement.prototype.hidePopover ??= function (this: HTMLElement) { this.dataset.shown = 'false'; };
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
URL.createObjectURL ??= ((blob: Blob) => `blob:test/${(blob as File).name ?? 'file'}`) as typeof URL.createObjectURL;
