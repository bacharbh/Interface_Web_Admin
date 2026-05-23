/**
 * workerBridge.ts — Logic to manage the position calculation worker.
 */

export class WorkerBridge {
  private worker: Worker | null = null;
  private onMessageCallback: (data: any) => void = () => {};

  constructor() {
    this.init();
  }

  private init() {
    try {
      this.worker = new Worker(
        new URL('../workers/positionWorker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (e) => {
        this.onMessageCallback(e.data);
      };

      this.worker.onerror = (e) => {
        console.error('Worker error:', e);
      };
    } catch (err) {
      console.error('Failed to initialize Web Worker:', err);
    }
  }

  public postData(payload: any) {
    if (this.worker) {
      this.worker.postMessage(payload);
    }
  }

  public onMessage(callback: (data: any) => void) {
    this.onMessageCallback = callback;
  }

  public terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
