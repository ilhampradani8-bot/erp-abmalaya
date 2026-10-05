/**
 * Utility to resolve the correct API endpoint and file URL depending on the environment.
 * 
 * Automatically converts any hardcoded localhost:8000 or 127.0.0.1:8000 links
 * to environment-agnostic relative paths so they work on both VPS IP (port 3000)
 * and production hosting (erp.abmalaya.com).
 */
export const getApiUrl = (path: string): string => {
  if (!path) return '';
  
  // Keep external Google Drive / Docs URLs intact
  if (path.includes('drive.google.com') || path.includes('docs.google.com')) {
    return path;
  }
  
  // Strip hardcoded localhost / 127.0.0.1 host and port
  let clean = path.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, '');
  
  // Ensure single leading slash for relative routing
  if (!clean.startsWith('/') && !clean.startsWith('http')) {
    clean = `/${clean}`;
  }
  
  return clean;
};
