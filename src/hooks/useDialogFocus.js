import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
const dialogs = [];

// Keep nested dialogs independent and restore focus to the control that opened them.
export default function useDialogFocus(ref, isOpen, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!isOpen || !dialog) return;
    const previous = document.activeElement;
    const hidden = [];
    dialogs.push(dialog);
    const isTopmost = () => dialogs.filter(item => !dialogs.some(other => item !== other && item.contains(other))).at(-1) === dialog;
    const isolate = () => {
      if (!isTopmost()) return;
      let branch = dialog;
      while (branch.parentElement && branch !== document.body) {
        for (const sibling of branch.parentElement.children) {
          if (sibling === branch || !(sibling instanceof HTMLElement) || sibling.inert) continue;
          sibling.inert = true;
          hidden.push(sibling);
        }
        branch = branch.parentElement;
      }
    };
    isolate();
    // Layout switches can replace background widgets while a settings dialog stays open.
    const observer = new MutationObserver(isolate);
    let branch = dialog;
    while (branch.parentElement && branch !== document.body) {
      observer.observe(branch.parentElement, { childList: true });
      branch = branch.parentElement;
    }
    const focusable = () => [...dialog.querySelectorAll(FOCUSABLE)].filter(el =>
      el.getClientRects().length && !el.closest('[inert]') && getComputedStyle(el).visibility !== 'hidden');
    const focusFirst = () => (focusable()[0] || dialog).focus({ preventScroll: true });
    // Focus the container so opening settings does not unexpectedly select a destructive action.
    dialog.focus({ preventScroll: true });
    const keydown = (event) => {
      if (!isTopmost() || event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current?.();
      } else if (event.key === 'Tab') {
        const items = focusable();
        const index = items.indexOf(document.activeElement);
        if (!items.length) {
          event.preventDefault();
          dialog.focus();
        } else if (event.shiftKey && index <= 0) {
          event.preventDefault();
          items.at(-1).focus();
        } else if (!event.shiftKey && (index === -1 || index === items.length - 1)) {
          event.preventDefault();
          items[0].focus();
        }
      }
    };
    const focusin = (event) => {
      if (isTopmost() && !dialog.contains(event.target)) focusFirst();
    };
    document.addEventListener('keydown', keydown);
    document.addEventListener('focusin', focusin);
    return () => {
      observer.disconnect();
      dialogs.splice(dialogs.lastIndexOf(dialog), 1);
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('focusin', focusin);
      hidden.forEach(el => { el.inert = false; });
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true });
    };
  }, [ref, isOpen]);
}
