import type { APIRoute } from 'astro';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

export const prerender = false;

const execPromise = promisify(exec);

export const GET: APIRoute = async ({ request, url }) => {
  return handleRequest(request, url);
};

export const POST: APIRoute = async ({ request, url }) => {
  return handleRequest(request, url);
};

export const ALL: APIRoute = async ({ request, url }) => {
  return handleRequest(request, url);
};

async function handleRequest(request: Request, url: URL) {
  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Requested-With'
      }
    });
  }

  // LOGGING: Comprehensive debug info
  const headerObj: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headerObj[key] = value;
  });
  
  let imgSrcParam: string | null = null;
  let rawBodyText = '';
  let extractionSource = 'none';

  // 1. Try URL search params (GET or POST with query string)
  imgSrcParam = url.searchParams.get('img');
  if (imgSrcParam) {
    extractionSource = 'context searchParams';
  } else {
    // Try manual parsing from the URL string
    const urlString = request.url;
    if (urlString.includes('?')) {
      const queryString = urlString.split('?')[1];
      const params = new URLSearchParams(queryString);
      imgSrcParam = params.get('img');
      if (imgSrcParam) extractionSource = 'manual split parsing';
    }
  }

  // 2. Try Headers (X-C2PA-Img)
  if (!imgSrcParam) {
    imgSrcParam = request.headers.get('x-c2pa-img');
    if (imgSrcParam) extractionSource = 'custom header';
  }

  // 3. Try POST body if still not found
  if (!imgSrcParam && (request.method === 'POST' || request.method === 'PUT')) {
    try {
      rawBodyText = await request.text();
      
      if (rawBodyText) {
        try {
          const body = JSON.parse(rawBodyText);
          imgSrcParam = body.img;
          if (imgSrcParam) extractionSource = 'POST JSON body';
        } catch (e) {
          // Fallback: If it's a simple string body
          imgSrcParam = rawBodyText.trim();
          if (imgSrcParam) extractionSource = 'POST raw text body';
        }
      }
    } catch (e: any) {
    }
  }

  // 3. Last ditch: regex on the URL string itself
  if (!imgSrcParam) {
    const match = request.url.match(/[?&]img=([^&]+)/);
    if (match) {
      imgSrcParam = decodeURIComponent(match[1]);
      extractionSource = 'regex fallback';
    }
  }
  
  if (!imgSrcParam) {
    return new Response(JSON.stringify({ 
      error: 'Missing img parameter',
      method: request.method,
      debug: {
        ctxUrl: url.toString(),
        reqUrl: request.url,
        headers: headerObj,
        rawBody: rawBodyText,
        extractionSource
      }
    }), {
      status: 400,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // Handle path security and extraction logic...
  let pathname = imgSrcParam;
  try {
    // If it's a full URL, get just the pathname
    if (imgSrcParam.startsWith('http') || imgSrcParam.startsWith('//')) {
      const u = new URL(imgSrcParam, 'http://localhost');
      pathname = u.pathname;
    }
  } catch (e) {}

  // Ensure it's a major photograph from the originals library (either local or R2)
  if (!pathname.includes('/originals/') && !pathname.includes('library/originals/')) {
    return new Response(JSON.stringify({ 
      error: 'Unauthorized path', 
      path: pathname,
      details: 'Content Credentials only available for major photographs.'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const rootDir = process.cwd();
    const publicDir = path.join(rootDir, 'public');
    // Extract the path after 'originals/'
    let relativePath = pathname;
    if (pathname.includes('/originals/')) {
      relativePath = '/library' + pathname.substring(pathname.indexOf('/originals/'));
    } else if (!pathname.startsWith('/')) {
      relativePath = '/' + pathname;
    }
    const absoluteImagePath = path.join(publicDir, relativePath.startsWith('/') ? relativePath.slice(1) : relativePath);
    
    // Check file existence
    try {
      await fs.access(absoluteImagePath);
    } catch (e) {
      return new Response(JSON.stringify({ 
        error: 'Image file not found on server', 
        path: absoluteImagePath 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const pythonPath = path.join(rootDir, '.venv', 'bin', 'python3');
    const scriptPath = path.join(rootDir, 'scripts', 'c2pa_xtract.py');

    const command = `"${pythonPath}" "${scriptPath}" "${absoluteImagePath}" --json`;
    const { stdout, stderr } = await execPromise(command);

    if (stderr && !stdout) {
      return new Response(JSON.stringify({ 
        error: 'Extraction script error', 
        details: stderr 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!stdout || stdout.trim() === '' || stdout.trim() === '{}') {
       return new Response(JSON.stringify({ 
         error: 'No Credentials Found', 
         message: 'This image does not contain C2PA Content Credentials.',
         details: 'The file was processed successfully, but no embedded manifest was detected.'
       }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(stdout, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ 
      error: 'Live extraction failed', 
      message: error.message,
      details: error.stderr || error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
