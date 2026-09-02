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
  // Always use relative paths — Vite proxy in dev mode forwards ^/api_.* to http://127.0.0.1:8000 internally,
  // and production web servers serve relative API paths directly.
  return path.startsWith('/') ? path : `/${path}`;
};


