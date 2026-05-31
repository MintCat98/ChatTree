// Allow side-effect imports of .css files (handled by webpack style-loader/css-loader).
declare module '*.css';
// ?raw imports return the CSS file content as a plain string.
declare module '*.css?raw' {
  const content: string;
  export default content;
}
