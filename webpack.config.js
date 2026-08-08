const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  devtool: 'cheap-source-map',
  // Webpack's default 244 KiB budget is a network-load heuristic for web pages.
  // MV3 extension bundles load from the user's disk (no network fetch), and a
  // content script must ship as a single file — code splitting would require
  // exposing chunks via web_accessible_resources and loading them into the
  // isolated world, with no runtime benefit since the panel mounts immediately.
  // 300 KiB still guards against runaway bundle growth. See issue #170.
  performance: {
    maxAssetSize: 300 * 1024,
    maxEntrypointSize: 300 * 1024,
  },
  entry: {
    background: './src/background/index.ts',
    content:    './src/content/index.ts',
    popup:      './src/popup/Popup.tsx',
    offscreen:  './src/offscreen/offscreen.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    parser: {
      javascript: { importMeta: false },
    },
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        // ?raw imports return CSS as a plain string (used for Shadow DOM injection).
        test: /\.css$/,
        resourceQuery: /raw/,
        type: 'asset/source',
      },
      {
        test: /\.css$/,
        resourceQuery: { not: [/raw/] },
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@content': path.resolve(__dirname, 'src/content'),
      '@background': path.resolve(__dirname, 'src/background'),
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/popup/index.html',
      filename: 'popup.html',
      chunks: ['popup'],
    }),
    new HtmlWebpackPlugin({
      template: './src/offscreen/offscreen.html',
      filename: 'offscreen.html',
      chunks: ['offscreen'],
      scriptLoading: 'module',
    }),
    new CopyPlugin({
      patterns: [
        { from: 'public/manifest.json', to: '.' },
        { from: 'src/assets', to: 'assets' },
        { from: 'src/content/content_styles.css', to: '.' },
        { from: 'public/models', to: 'models' },
        { from: 'node_modules/onnxruntime-web/dist/*.wasm', to: 'wasm/[name][ext]' },
        { from: 'node_modules/onnxruntime-web/dist/ort-wasm-*.mjs', to: 'wasm/[name][ext]' },
      ],
    }),
  ],
};