const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    popup: './src/popup.jsx',
    background: './background.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './popup/index.html',
      filename: 'popup/index.html',
      chunks: ['popup']
    }),
    new CopyPlugin({
      patterns: [
        {
          from: 'content-scripts',
          to: 'content-scripts',
          globOptions: {
            ignore: ['**/*.md']
          }
        }
      ]
    })
  ],
  resolve: {
    extensions: ['.js', '.jsx']
  },
  mode: 'development'
};
