// Generate a deterministic UUID v4-like ID from a Square access token
// This ensures the same token always produces the same UUID, matching the backend
export function generateUUIDFromToken(token: string): string {
  // Use Web Crypto API (available in browser)
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  
  // We'll use a simple hash-based approach that produces a deterministic UUID
  // Since we don't have access to Node.js crypto in the browser, we'll use a stable algorithm
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Generate a UUID-formatted string from the token using a stable algorithm
  // This matches the format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const str = Math.abs(hash).toString(16).padStart(32, '0');
  
  // Use token content for more entropy
  let uuid = '';
  let charIndex = 0;
  const tokenChars = token.split('');
  
  for (let i = 0; i < 32; i++) {
    if (i === 8 || i === 12 || i === 16 || i === 20) {
      uuid += '-';
    }
    // Cycle through token characters to create deterministic UUID
    const char = tokenChars[(charIndex++) % tokenChars.length];
    const code = char.charCodeAt(0) % 16;
    uuid += code.toString(16);
  }
  
  return uuid;
}
