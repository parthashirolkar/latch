import { createPortal } from 'react-dom'

interface ConfirmationModalProps {
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmationModal({
  message,
  onConfirm,
  onCancel
}: ConfirmationModalProps) {
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-[9999]"
      onClick={onCancel}
    >
      <div
        className="bg-theme-surface border-2 border-theme-accent p-6 max-w-[360px] w-[calc(100%-32px)] m-0 mx-4 shadow-theme"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-theme-text text-base leading-relaxed mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-theme-bg text-theme-text-secondary border-2 border-theme-accent font-theme text-sm cursor-pointer transition-colors duration-200 hover:bg-theme-surface hover:text-theme-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-theme-accent text-theme-bg border-2 border-theme-accent font-bold font-theme text-sm cursor-pointer transition-colors duration-200 hover:bg-theme-text"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}



