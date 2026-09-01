/**
 * Utility to resolve the correct API endpoint URL depending on the environment.
 * 
 * In local development (Vite running on localhost/127.0.0.1), it prefixes endpoints
 * with http://localhost:8000 (the XAMPP PHP backend port).
 * 
 * In production hosting (cPanel live environment), it uses relative URLs, which resolve
 * to the hosted domain automatically.
 */
export const getApiUrl = (path: string): string => {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
    return `http://localhost:8000${path}`;
  }
  return path;
};
