import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['dist/**/*']
  },
  {
    files: ['firestore.rules'],
    plugins: {
      '@firebase/security-rules': firebaseRulesPlugin
    },
    languageOptions: {
      parser: tsParser
    },
    rules: {
      ...firebaseRulesPlugin.configs['flat/recommended'].rules
    }
  }
];
