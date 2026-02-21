const path = require("path");
const webpack = require("webpack"); // ✅ was missing
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  entry: "./src/index.tsx",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
    clean: true,
  },

  // ✅ Fast rebuilds in dev, full separate source maps in prod
  devtool:
    process.env.NODE_ENV === "production" ? "source-map" : "eval-source-map",

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
      // ✅ Dev: use TS source directly (no build step needed)
      // Prod: use compiled JS from dist (tsc must run first)
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
    // ✅ Replaces process.env.X at build time with the actual string value
    // Without this, the browser receives the literal text "process.env.X"
    // and throws "process is not defined"
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(
        process.env.NODE_ENV || "development",
      ),
      "process.env.REACT_APP_API_URL": JSON.stringify(
        process.env.REACT_APP_API_URL || "http://localhost:4000",
      ),
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
    // ✅ Filters out serve-index middleware to suppress URIError in dev server
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
