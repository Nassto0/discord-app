import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore } from '@/stores/toastStore';

export function ToastViewport() {
  const { toasts, remove } = useToastStore();

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            onClick={() => remove(toast.id)}
            className={`pointer-events-auto rounded-lg border px-3 py-2 text-left text-sm shadow-lg ${
              toast.type === 'error'
                ? 'border-red-500/50 bg-red-950/90 text-red-100'
                : toast.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100'
                : 'border-border/60 bg-card/95 text-foreground'
            }`}
          >
            {toast.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

