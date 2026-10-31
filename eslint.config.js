// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'docs/*', 'tools/*', 'site/*', 'android/*', 'ios/*', 'coverage/*'],
  },
  {
    rules: {
      // TypeScript already checks namespace members (and knows re-exported enums the import plugin misses)
      'import/namespace': 'off',
      // React Compiler rules. Pavurio doesn't use the compiler, and these flag patterns that are correct
      // here: Reanimated shared values are mutated by design (`sv.value = …`), the "latest callback" ref,
      // and Date.now() for "is it past?" labels.
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
