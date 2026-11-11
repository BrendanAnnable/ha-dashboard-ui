import type { StorybookConfig } from '@storybook/web-components-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],
  addons: ['@storybook/addon-docs', '@storybook/addon-vitest'],
  framework: { name: '@storybook/web-components-vite', options: {} },
  async viteFinal(config) {
    const { mergeConfig } = await import('vite');
    return mergeConfig(config, { define: { __VERSION__: JSON.stringify('storybook'), __LEGACY_ALIAS__: 'true' } });
  },
};

export default config;
