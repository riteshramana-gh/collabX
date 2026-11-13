/**
 * Copies text to the clipboard reliably across secure contexts (HTTPS / localhost)
 * and non-secure LAN HTTP IP connections (e.g. http://192.168.x.x:8000).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // 1. Try modern Clipboard API if available and permitted
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below if permission denied or origin is non-secure HTTP
    }
  }

  // 2. Fallback to hidden textarea with execCommand('copy')
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.warn('[Clipboard] Failed to copy to clipboard:', err);
    return false;
  }
}
