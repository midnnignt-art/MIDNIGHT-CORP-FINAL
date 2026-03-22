export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
    id: number;
    message: string;
    type: ToastType;
}

type Listener = (toasts: ToastItem[]) => void;

let _toasts: ToastItem[] = [];
let _counter = 0;
const _listeners = new Set<Listener>();

function notify() {
    _listeners.forEach(fn => fn([..._toasts]));
}

function add(message: string, type: ToastType, duration = 3500) {
    const id = ++_counter;
    _toasts = [..._toasts, { id, message, type }];
    notify();
    setTimeout(() => {
        _toasts = _toasts.filter(t => t.id !== id);
        notify();
    }, duration);
}

export const toast = {
    success: (msg: string) => add(msg, 'success'),
    error: (msg: string) => add(msg, 'error'),
    info: (msg: string) => add(msg, 'info'),
};

export function subscribeToToasts(listener: Listener): () => void {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
}
