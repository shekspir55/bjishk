import * as punycode from 'punycode';

/**
 * Process a URL to handle internationalized domain names using punycode
 * @param inputUrl The URL to process
 * @returns The processed URL with punycode if needed
 */
export function processUrl(inputUrl: string): string {
  try {
    const urlObj = new URL(inputUrl);
    
    // Convert IDN hostname to punycode if needed
    if (/[^\u0000-\u007F]/.test(urlObj.hostname)) {
      console.debug(`Converting internationalized domain: ${urlObj.hostname}`);
      const punycodeHostname = punycode.toASCII(urlObj.hostname);
      urlObj.hostname = punycodeHostname;
      console.debug(`Converted to punycode: ${punycodeHostname}`);
      return urlObj.toString();
    }
    
    return inputUrl;
  } catch (err) {
    console.error(`Error processing URL ${inputUrl}:`, err);
    return inputUrl; // Return original URL if processing fails
  }
}

/**
 * Convert a punycode URL back to a human-readable internationalized domain name
 * @param inputUrl The punycode URL to convert
 * @returns The URL with a human-readable domain name
 */
export function displayUrl(inputUrl: string): string {
  try {
    const urlObj = new URL(inputUrl);
    
    // Check if the hostname uses punycode (starts with 'xn--')
    if (urlObj.hostname.includes('xn--')) {
      console.debug(`Converting punycode domain back: ${urlObj.hostname}`);
      const unicodeHostname = punycode.toUnicode(urlObj.hostname);
      urlObj.hostname = unicodeHostname;
      console.debug(`Converted to Unicode: ${unicodeHostname}`);
      return urlObj.toString();
    }
    
    return inputUrl;
  } catch (err) {
    console.error(`Error processing display URL ${inputUrl}:`, err);
    return inputUrl; // Return original URL if processing fails
  }
} 