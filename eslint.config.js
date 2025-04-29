import { configs } from '@vcsuite/eslint-config';

export default [
  ...configs.vue,
  {
    rules: {
      'import/no-cycle': [
        'error',
        {
          ignoreExternal: true,
          allowUnsafeDynamicCyclicDependency: false,
          disableScc: true,
        },
      ],
    },
  },
  {
    ignores: ['node_modules/', 'dist/'],
  },
];
