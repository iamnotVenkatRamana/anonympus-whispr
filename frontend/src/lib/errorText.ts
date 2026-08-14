/**
 * Extracted verbatim from EncryptedReportForm.tsx so DeployContract.tsx can
 * render the same wallet/SDK error chains (Effect-TS FiberFailures included)
 * without duplicating the walk-the-cause-chain logic.
 */
export const fullErrorText = (error: unknown): string => {
  const describe = (value: unknown): string => {
    if (value instanceof Error) return `${value.name || 'Error'}: ${value.message}`;
    if (typeof value === 'object' && value !== null) {
      try {
        return JSON.stringify(value, Object.getOwnPropertyNames(value));
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const parts: string[] = [];
  const seen = new Set<unknown>();
  for (
    let current: unknown = error;
    current !== undefined && current !== null && !seen.has(current);
    current = current instanceof Error ? current.cause : (current as { cause?: unknown }).cause
  ) {
    seen.add(current);
    parts.push(describe(current));
    if (typeof current !== 'object') break;
  }
  return parts.join(' | caused by | ') || 'Unknown error';
};
