import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/sdk/index.ts'],
  format: ['esm', 'cjs'],
  dts: false, // 暂时禁用 DTS 生成，待类型问题解决后重新启用
  clean: true,
  sourcemap: true,
  treeshake: true,
  target: 'es2020',
});
