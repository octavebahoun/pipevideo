import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import * as fs from 'fs/promises';
import * as path from 'path';

async function logToFile(message: string) {
  try {
    const logPath = path.join(process.cwd(), 'webhook.log');
    const timestamp = new Date().toISOString();
    await fs.appendFile(logPath, `[${timestamp}] ${message}\n`, 'utf-8');
  } catch (err) {
    console.error('Failed to write log to file:', err);
  }
}

function parseStoryboard(result: any): any | null {
  if (!result) return null;

  // Case 1: The response has a "storyboard" key
  if (result.storyboard) {
    return result.storyboard;
  }

  // Case 2: The response is from n8n's Agent / LangChain node (which puts the LLM text output in the "output" key)
  if (result.output) {
    if (typeof result.output === 'string') {
      try {
        let cleaned = result.output.trim();
        // Remove markdown formatting if any (ex: ```json ... ```)
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        }
        const parsed = JSON.parse(cleaned);
        return parsed.storyboard || parsed;
      } catch (err: any) {
        logToFile(`[ERROR] Failed to parse result.output string as JSON: ${err.message}`);
      }
    } else if (typeof result.output === 'object') {
      return result.output.storyboard || result.output;
    }
  }

  // Case 3: The response is already the storyboard object directly
  if (Array.isArray(result.scenes) || result.title) {
    return result;
  }

  // Case 4: The result is a raw string containing JSON
  if (typeof result === 'string') {
    try {
      let cleaned = result.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }
      const parsed = JSON.parse(cleaned);
      return parsed.storyboard || parsed;
    } catch (err: any) {
      logToFile(`[ERROR] Failed to parse raw string result as JSON: ${err.message}`);
    }
  }

  return null;
}

// Auth expected by the n8n Webhook node on the outgoing call (pipevideo -> n8n).
// Distinct from N8N_WEBHOOK_SECRET, which guards the incoming direction
// (n8n -> pipevideo, see src/middleware.ts). Without these, an n8n webhook
// configured with Header Auth / Basic Auth answers 403 "Authorization data is wrong!"
// and the workflow never starts.
function n8nAuthHeaders(): Record<string, string> {
  const headerName = process.env.N8N_WORKFLOW_AUTH_HEADER;
  const headerValue = process.env.N8N_WORKFLOW_AUTH_VALUE;
  if (headerName && headerValue) {
    return { [headerName]: headerValue };
  }

  const user = process.env.N8N_WORKFLOW_BASIC_USER;
  const pass = process.env.N8N_WORKFLOW_BASIC_PASSWORD;
  if (user && pass) {
    const encoded = Buffer.from(`${user}:${pass}`).toString('base64');
    return { Authorization: `Basic ${encoded}` };
  }

  return {};
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topic, title } = body;

    if (!topic || !title) {
      await logToFile(`[ERROR] Missing topic or title. Body: ${JSON.stringify(body)}`);
      return NextResponse.json({ error: 'Missing topic or title' }, { status: 400 });
    }

    const video = await prisma.video.create({
      data: {
        title,
        topic,
        status: 'DRAFT',
        voice: 'george',
        ratio: '9:16',
      },
    });

    await logToFile(`[INFO] Video created in DB: ID=${video.id}, Title="${title}", Topic="${topic}"`);

    if (process.env.N8N_WORKFLOW_URL) {
      const authHeaders = n8nAuthHeaders();
      await logToFile(
        `[INFO] Triggering n8n workflow at ${process.env.N8N_WORKFLOW_URL}` +
          ` (auth: ${Object.keys(authHeaders)[0] ?? 'none'})...`
      );
      try {
        const response = await fetch(process.env.N8N_WORKFLOW_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            videoId: video.id,
            message: topic,
            topic,
            title,
          }),
        });

        await logToFile(`[INFO] n8n responded with HTTP status ${response.status}`);

        if (response.ok) {
          const result = await response.json().catch(() => null);
          await logToFile(`[INFO] Raw n8n response body: ${JSON.stringify(result, null, 2)}`);

          const storyboard = parseStoryboard(result);
          if (storyboard) {
            const updatedVideo = await prisma.video.update({
              where: { id: video.id },
              data: {
                storyboard,
                status: 'SCRIPTED',
                title: storyboard.title || undefined,
                voice: storyboard.voice || undefined,
              },
            });
            await logToFile(`[SUCCESS] Storyboard parsed and updated in DB for video ${video.id}. Status set to SCRIPTED.`);
            return NextResponse.json(updatedVideo);
          } else {
            await logToFile(`[WARNING] Could not parse any storyboard from the n8n response. Status remains DRAFT.`);
          }
        } else {
          const errorText = await response.text().catch(() => '');
          await logToFile(`[ERROR] n8n returned error status ${response.status}: ${errorText}`);
          if (response.status === 401 || response.status === 403) {
            await logToFile(
              `[HINT] n8n rejected the credentials: the Webhook node has authentication enabled.` +
                ` Set N8N_WORKFLOW_AUTH_HEADER + N8N_WORKFLOW_AUTH_VALUE (Header Auth)` +
                ` or N8N_WORKFLOW_BASIC_USER + N8N_WORKFLOW_BASIC_PASSWORD (Basic Auth) in .env.`
            );
          } else if (response.status === 404) {
            await logToFile(
              `[HINT] n8n returned 404: the workflow is probably not activated, or the URL uses` +
                ` /webhook-test/ (test mode, only live while "Execute workflow" is running) instead of /webhook/.`
            );
          }
        }
      } catch (err: any) {
        await logToFile(`[ERROR] Failed to fetch N8N_WORKFLOW_URL: ${err.message || err}`);
      }
    } else {
      await logToFile(`[WARNING] N8N_WORKFLOW_URL is not set in .env. Skipping n8n trigger.`);
    }

    return NextResponse.json(video);
  } catch (error: any) {
    await logToFile(`[FATAL] Error in POST handler: ${error.message || error}`);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
