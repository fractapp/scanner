require('babel-polyfill');
module.exports = {
    plugins: [
      '@babel/plugin-transform-runtime',
      [
        'rewrite-require',
        {
          aliases: {
            _stream_duplex: 'readable-stream/duplex',
            _stream_passthrough: 'readable-stream/passthrough',
            _stream_readable: 'readable-stream/readable',
            _stream_transform: 'readable-stream/transform',
            _stream_writable: 'readable-stream/writable',
            stream: 'readable-stream',
            vm: 'vm-browserify',
          },
        },
      ],
      [
        'module-resolver',
        {
          alias: {
            cmd: './src/cmd',
            models: './src/models',
            adaptors: './src/adaptors',
          },
          root: ['.'],
        },
      ],
    ],
    presets: ['@babel/preset-env', '@babel/preset-typescript'],
  };
  