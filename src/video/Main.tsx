import React from 'react';
import { Series, useVideoConfig } from 'remotion';
import { Storyboard } from '../types';
import { SceneComponent } from './Scene';

interface MainProps {
  storyboard: Storyboard;
}

export const Main: React.FC<MainProps> = ({ storyboard }) => {
  const { fps } = useVideoConfig();

  return (
    <div style={{ flex: 1, backgroundColor: 'black', position: 'relative' }}>
      <Series>
        {storyboard.scenes.map((scene) => {
          const durationInFrames = Math.max(
            30,
            Math.ceil((scene.durationInSeconds || 2) * fps)
          );

          return (
            <Series.Sequence 
              key={scene.id} 
              durationInFrames={durationInFrames}
            >
              <SceneComponent 
                scene={scene} 
                fps={fps} 
                durationInFrames={durationInFrames} 
              />
            </Series.Sequence>
          );
        })}
      </Series>
    </div>
  );
};
