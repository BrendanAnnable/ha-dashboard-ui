import type { Preview } from '@storybook/web-components-vite';
import './ha-stand-ins';
import './theme.css';
import '../src/index';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Home Assistant theme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    (story, context) => {
      document.documentElement.classList.toggle('dark', context.globals.theme === 'dark');
      return story();
    },
  ],
  parameters: {
    layout: 'padded',
    backgrounds: { disable: true },
  },
};

export default preview;
