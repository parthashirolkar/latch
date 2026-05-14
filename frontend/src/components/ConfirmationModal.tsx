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
        className="bg-[#222] border-2 border-brutal-yellow p-6 max-w-[360px] w-[calc(100%-32px)] m-0 mx-4 shadow-[6px_6px_0px_var(--color-brutal-yellow)]"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-brutal-white text-base leading-relaxed mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-brutal-black text-white/80 border-2 border-brutal-yellow font-mono text-sm cursor-pointer transition-colors duration-200 hover:bg-[#222] hover:text-brutal-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-brutal-yellow text-brutal-black border-2 border-brutal-yellow font-bold font-mono text-sm cursor-pointer transition-colors duration-200 hover:bg-brutal-white"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
