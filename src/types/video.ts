export interface VideoRecord {
  id: string;
  title: string;
  topic: string;
  status: string;
  voice: string;
  ratio: string;
  storyboard: any;
  videoPath: string | null;
  youtubeId: string | null;
  youtubeStatus: string | null;
  scheduledFor: string | null;
  progress: number;
  progressStep: string | null;
  createdAt: string;
  updatedAt: string;
}
