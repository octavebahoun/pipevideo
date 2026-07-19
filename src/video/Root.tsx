import { Composition } from 'remotion';
import { Main } from './Main';
import {
  mainPropsSchema,
  Storyboard,
  FPS,
  getTotalDurationInFrames,
  getDimensions,
} from '../types';
import defaultStoryboard from '../../storyboard.json';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ContentFactory"
      component={Main}
      schema={mainPropsSchema}
      fps={FPS}
      // Valeurs de secours : recalculées par calculateMetadata à partir du storyboard réel.
      durationInFrames={FPS}
      width={1920}
      height={1080}
      defaultProps={{ storyboard: defaultStoryboard as Storyboard }}
      calculateMetadata={({ props }) => {
        const { storyboard } = props;
        const { width, height } = getDimensions(storyboard);
        return {
          durationInFrames: getTotalDurationInFrames(storyboard, FPS),
          width,
          height,
        };
      }}
    />
  );
};
