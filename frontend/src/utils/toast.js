
const listeners = new Set();

export const toast = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  show(message, type = 'info') {
    const id = Date.now() + Math.random();
    listeners.forEach(listener => listener({ id, message, type }));
  },
  success(message) {
    this.show(message, 'success');
  },
  error(message) {
    this.show(message, 'error');
  },
  warning(message) {
    this.show(message, 'warning');
  },
  info(message) {
    this.show(message, 'info');
  }
};
