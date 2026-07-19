import { Composition } from 'remotion';
import { Main } from './Main';
import { Storyboard } from '../types';
import defaultStoryboard from '../../storyboard.json';

export const RemotionRoot: React.FC = () => {
  // En production/rendu, Remotion peut recevoir les props depuis l'extérieur (inputProps).
  // On utilise defaultStoryboard comme fallback.
  const storyboard = defaultStoryboard as unknown as Storyboard;
  const fps = 30;
  
  const totalDuration = storyboard.scenes.reduce(
    (acc, scene) => acc + (scene.durationInSeconds || 2), 
    0
  );
  const durationInFrames = Math.max(30, Math.ceil(totalDuration * fps));

  const width = storyboard.ratio === '9:16' ? 1080 : 1920;
  const height = storyboard.ratio === '9:16' ? 1920 : 1080;

  return (
    <>
      <Composition
        id="ContentFactory"
        component={Main}
        durationInFrames={durationInFrames}
        fps={fps}
        width={width}
        height={height}
        defaultProps={{
          storyboard
        }}
      />
    </>
  );
};
