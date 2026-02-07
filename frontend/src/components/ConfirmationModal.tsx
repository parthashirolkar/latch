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
      className="confirmation-modal-overlay"
      onClick={onCancel}
    >
      <div
        className="confirmation-modal-content"
        onClick={e => e.stopPropagation()}
      >
        <p className="confirmation-modal-message">{message}</p>
        <div className="confirmation-modal-actions">
          <button
            type="button"
            onClick={onCancel}
            className="confirmation-modal-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="confirmation-modal-confirm"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
