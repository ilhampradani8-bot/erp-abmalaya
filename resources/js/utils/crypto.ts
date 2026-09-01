// Utility for encrypting and decrypting sensitive credentials (e.g. App Passwords)

const SECRET_KEY = 'ABMALAYA_ERP_SECURE_ENCRYPTION_KEY_2026';

export const encryptData = (plainText: string): string => {
  if (!plainText) return '';
  try {
    // Simple secure XOR + Base64 cipher simulation for client/storage persistence
    const textChars = plainText.split('');
    const keyChars = SECRET_KEY.split('');
    const cipherNums = textChars.map((char, index) => {
      const charCode = char.charCodeAt(0);
      const keyCode = keyChars[index % keyChars.length].charCodeAt(0);
      return charCode ^ keyCode;
    });
    const cipherStr = String.fromCharCode(...cipherNums);
    return 'ENC:' + btoa(cipherStr);
  } catch (e) {
    return plainText;
  }
};

export const decryptData = (cipherText: string): string => {
  if (!cipherText) return '';
  if (!cipherText.startsWith('ENC:')) return cipherText; // Return if unencrypted fallback
  try {
    const rawCipher = atob(cipherText.replace('ENC:', ''));
    const cipherNums = rawCipher.split('').map(c => c.charCodeAt(0));
    const keyChars = SECRET_KEY.split('');
    const plainNums = cipherNums.map((num, index) => {
      const keyCode = keyChars[index % keyChars.length].charCodeAt(0);
      return num ^ keyCode;
    });
    return String.fromCharCode(...plainNums);
  } catch (e) {
    return cipherText;
  }
};
