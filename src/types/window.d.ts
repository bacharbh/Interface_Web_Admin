export {};

declare global {
  interface Window {
    motion?: any;
    L?: any;
    lucideReact?: any;
    runAllTests?: () => void;
  }
}
