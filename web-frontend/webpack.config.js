const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");

module.exports = (env, argv) => {
  const mode = (argv && argv.mode) || process.env.NODE_ENV || "development";
  const isProd = mode === "production";

  return {
    entry: "./src/index.js",

    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "bundle.js",
      publicPath: "/",
      clean: true,
    },

    resolve: {
      extensions: [".js", ".jsx"],
    },

    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
          },
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
        {
          test: /\.(png|jpg|gif|svg|ico)$/,
          type: "asset/resource",
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/,
          type: "asset/resource",
        },
      ],
    },

    plugins: [
      // Inject bundle.js into the HTML template
      new HtmlWebpackPlugin({
        template: "./public/index.html",
        filename: "index.html",
        inject: "body",
      }),

      // webpack 5 no longer polyfills process automatically.
      // DefinePlugin replaces process.env.* string patterns at compile time
      // so no runtime 'process' object is needed anywhere in the bundle.
      new webpack.DefinePlugin({
        "process.env.NODE_ENV": JSON.stringify(mode),
        "process.env.REACT_APP_API_URL": JSON.stringify(
          process.env.REACT_APP_API_URL || ""
        ),
        "process.env.REACT_APP_WS_URL": JSON.stringify(
          process.env.REACT_APP_WS_URL || ""
        ),
      }),
    ],

    devServer: {
      static: {
        directory: path.join(__dirname, "public"),
      },
      port: 3000,
      hot: true,
      open: false,
      historyApiFallback: true,
      compress: true,
    },

    devtool: isProd ? "source-map" : "cheap-module-source-map",
  };
};
