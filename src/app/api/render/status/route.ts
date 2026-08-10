import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import * as fs from 'fs/promises';
import * as path from 'path';
import { computeSceneCacheStatus } from '@/lib/renderCache';

/**
 * Reports how many scenes of a video already have up-to-date cached assets in
 * public/, so the UI can show "5/8 scenes ready" and let the user choose
 * between resuming (reusing that cache) or starting fresh.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }
    if (!video.storyboard) {
      return NextResponse.json({ totalScenes: 0, readyScenes: 0, scenes: [] });
    }

    const snapshotPath = path.join(process.cwd(), 'public', `.storyboard-snapshot-${id}.json`);
    let previousStoryboard: any = null;
    try {
      previousStoryboard = JSON.parse(await fs.readFile(snapshotPath, 'utf-8'));
    } catch (_) {}

    const scenes = await computeSceneCacheStatus(video.storyboard, previousStoryboard);
    const readyScenes = scenes.filter((s) => s.audioReady && s.mediaReady).length;

    return NextResponse.json({ totalScenes: scenes.length, readyScenes, scenes });
  } catch (error: any) {
    console.error('Error computing render status:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
