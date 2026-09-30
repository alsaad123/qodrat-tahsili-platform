import { onRequestPost, onRequestOptions } from './functions/api/scan-exam';

export interface Env {
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>;
  };
  GEMINI_API_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API Route for Exam Vision OCR
    if (url.pathname === '/api/scan-exam') {
      if (request.method === 'OPTIONS') {
        return onRequestOptions();
      }
      if (request.method === 'POST') {
        return onRequestPost({ request, env });
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Serve all static assets from dist/ (Vite build)
    return env.ASSETS.fetch(request);
  }
};
