// packages/web/webpack.config.js
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  entry: "./src/index.tsx",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
    clean: true,
  },
  devtool: "source-map",

  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              ["@babel/preset-env", { modules: false }],
              ["@babel/preset-react", { runtime: "automatic" }],
              "@babel/preset-typescript",
            ],
          },
        },
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
    ],
  },

  resolve: {
    extensions: [".js", ".jsx", ".ts", ".tsx"],
    alias: {
      react: path.resolve(__dirname, "../../node_modules/react"),
      "react-dom": path.resolve(__dirname, "../../node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(
        __dirname,
        "../../node_modules/react/jsx-runtime",
      ),
      "react-dom/client": path.resolve(
        __dirname,
        "../../node_modules/react-dom/client",
      ),
      "@demo/common":
        process.env.NODE_ENV === "production"
          ? path.resolve(__dirname, "../common/dist")
          : path.resolve(__dirname, "../common/src"),
    },
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: "./public/index.html",
    }),
  ],

  devServer: {
    port: 3000,
    hot: true,
    open: true,
    historyApiFallback: true,
    static: {
      directory: path.join(__dirname, "public"),
    },
    client: {
      logging: "warn",
      overlay: {
        errors: true,
        warnings: false,
      },
    },
    // ✅ ADD THIS: Suppress URIError from serve-index middleware
    setupMiddlewares: (middlewares, devServer) => {
      if (!devServer) throw new Error("webpack-dev-server is not defined");

      // Option 1: Filter out serve-index entirely (simplest)
      return middlewares.filter((m) => m.name !== "serve-index");

      // Option 2: Wrap middleware to catch URIError (if you need serve-index)
      /*
      return middlewares.map((m) => {
        if (m.handle && m.name === "serve-index") {
          const originalHandle = m.handle;
          m.handle = function (req, res, next) {
            try {
              originalHandle.apply(this, arguments);
            } catch (err) {
              if (err instanceof URIError) {
                // Silently ignore malformed URI
                next();
              } else {
                throw err;
              }
            }
          };
        }
        return m;
      });
      */
    },
  },
};
