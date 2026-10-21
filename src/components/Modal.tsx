import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Modal({
    children,
    label,
    description,
    className = 'game-dialog',
    busy = false,
    closeOnBackdrop = false,
    onClose
}: {
    children: ReactNode;
    label: string;
    description?: string;
    className?: string;
    busy?: boolean;
    closeOnBackdrop?: boolean;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDialogElement>(null),
        close = useRef(onClose);
    close.current = onClose;
    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        dialog.showModal();
        return () => {
            if (dialog.open) dialog.close();
        };
    }, []);
    return createPortal(
        <dialog
            ref={ref}
            className={className}
            aria-labelledby={label}
            aria-describedby={description}
            onCancel={(event) => {
                event.preventDefault();
                if (!busy) close.current();
            }}
            onClick={(event) => {
                if (!closeOnBackdrop || busy || event.target !== event.currentTarget) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                if (
                    event.clientX < bounds.left ||
                    event.clientX > bounds.right ||
                    event.clientY < bounds.top ||
                    event.clientY > bounds.bottom
                )
                    close.current();
            }}
        >
            {children}
        </dialog>,
        document.body
    );
}
export function CloseButton({
    onClick,
    label,
    disabled = false
}: {
    onClick: () => void;
    label: string;
    disabled?: boolean;
}) {
    return (
        <button
            className="close-button"
            type="button"
            onClick={onClick}
            aria-label={label}
            disabled={disabled}
        >
            ×
        </button>
    );
}
export function FormError({ text }: { text: string }) {
    return text ? (
        <p className="form-error" role="alert">
            {text}
        </p>
    ) : null;
}
