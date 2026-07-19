export interface Scene {
  id: number;
  narration: string;
  mediaPath?: string; // local image or video path (e.g. media/scene_1.png)
  subtitle?: string; // optional subtitle text (default: narration)
  effects?: {
    zoom?: 'in' | 'out' | 'none';
    transition?: 'fade' | 'slide' | 'none';
  };
  durationInSeconds?: number; // generated and injected by tts.ts
}

export interface Storyboard {
  title: string;
  ratio: '16:9' | '9:16';
  voice?: string; // Edge TTS voice name (default: fr-FR-HenriNeural)
  scenes: Scene[];
}
