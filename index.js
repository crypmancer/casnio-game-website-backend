/**
 * adashufflecom Backend REST API main entry file
 *
 * Author: MaveGuy
 */

// Require Dependencies
import app from "./controllers/express-app.js";
import colors from "colors/safe.js";
import { Server } from "http";
import { connectDatabase } from "./utils/index.js";
import { startSocketServer } from "./controllers/websockets.js";

// Declare useful variables
process.title = "adashufflecom-api";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 5000;

// Connect Database
connectDatabase();

// Create HTTP server
const server = Server(app);

// Start WebSocket server
startSocketServer(server, app);

// Setup HTTP server and start listening on the given port
server.listen(PORT, () =>
  console.log(
    colors.green(
      `Server >> Listening on port ${PORT} (Production: ${IS_PRODUCTION})`
    )
  )
);

// Export HTTP server
export { server };
