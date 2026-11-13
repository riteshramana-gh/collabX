/**
 * Robust clipboard copying utility for local LAN environments.
 * Modern browsers restrict navigator.clipboard to secure contexts (HTTPS or localhost).
 * When running over LAN HTTP (e.g. http://192.168.x.x:8000), this utility seamlessly
 * falls back to a temporary textarea with document.execCommand('copy').
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern Clipboard API if supported and context is secure
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('[Clipboard] navigator.clipboard failed, attempting fallback:', err);
    }
  }

  // 2. Fallback using invisible textarea & execCommand('copy')
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('[Clipboard] Fallback document.execCommand copy failed:', err);
    return false;
  }
}
