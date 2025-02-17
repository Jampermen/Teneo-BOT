const WebSocket = require("ws");
const fs = require("fs");
const logger = require("./config/logger");
const colors = require("./config/colors");
const displayBanner = require("./config/banner");
const { spawn } = require("child_process");

const CONFIG = {
  WS: {
    BASE_URL: "wss://secure.ws.teneo.pro/websocket",
    VERSION: "v0.2",
    PING_INTERVAL: 10000,
    HEADERS: {
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Origin: "chrome-extension://emcdcoaglgspoogqfiggmhnhgabhppkm",
      Pragma: "no-cache",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
  },
  RECONNECT: {
    ATTEMPTS_BEFORE_RESTART: 20,
    BASE_DELAY: 30000,
    MAX_DELAY: 120000,
    JITTER: 5000,
  },
  FILES: {
    TOKEN_FILE: "data.txt",
  },
  MESSAGE_TYPES: {
    CONNECT: "Connected successfully",
    PULSE: "Pulse from server",
    PING: "PING",
  },
  TIME_FORMAT: {
    hour12: false,
  },
};

const formatAccountPrefix = (accountIndex) => {
  const paddedIndex = accountIndex.toString().padStart(2, "0");
  return `${colors.accountName}Account ${paddedIndex}${colors.reset}`;
};

const formatPoints = (points) =>
  `${colors.brightGreen}${points.toString().padStart(6, " ")}${colors.reset}`;

const formatTime = (date) =>
  new Date(date).toLocaleTimeString("en-US", CONFIG.TIME_FORMAT);

const formatMessage = (prefix, message) => {
  const paddedPrefix = prefix.padEnd(0, " ");
  return `${paddedPrefix} > ${message}`;
};

function restartProgram() {
  const script = process.argv[1];
  const args = process.argv.slice(2);

  const child = spawn(process.execPath, [script, ...args], {
    stdio: "inherit",
    detached: true,
  });

  child.unref();
  process.exit();
}

class WebSocketClient {
  constructor(token, accountIndex) {
    this.ws = null;
    this.pingInterval = null;
    this.reconnectAttempts = 0;
    this.token = token;
    this.accountIndex = accountIndex;
    this.isRestarting = false;
  }

  async connect() {
    try {
      const wsUrl = `${CONFIG.WS.BASE_URL}?accessToken=${this.token}&version=${CONFIG.WS.VERSION}`;
      this.ws = new WebSocket(wsUrl, { headers: CONFIG.WS.HEADERS });
      this.setupWebSocketEvents();
    } catch (error) {
      logger.error(
        formatMessage(
          formatAccountPrefix(this.accountIndex),
          `Connection error: ${error}`
        )
      );
      this.handleReconnect();
    }
  }

  setupWebSocketEvents() {
    this.ws.on("open", () => {
      logger.success(
        formatMessage(
          formatAccountPrefix(this.accountIndex),
          "Connected to WebSocket server"
        )
      );
      this.startPing();
      this.reconnectAttempts = 0;
    });

    this.ws.on("message", (data) => {
      try {
        const message = JSON.parse(data);
        const formattedTime = formatTime(message.date);
        const prefix = formatAccountPrefix(this.accountIndex);

        if (message.message === CONFIG.MESSAGE_TYPES.CONNECT) {
          this.handleConnectMessage(prefix, formattedTime, message);
        } else if (message.message === CONFIG.MESSAGE_TYPES.PULSE) {
          this.handlePulseMessage(prefix, formattedTime, message);
        }
      } catch (error) {
        logger.error(
          formatMessage(
            formatAccountPrefix(this.accountIndex),
            `Error parsing message: ${error}`
          )
        );
      }
    });

    this.ws.on("close", () => {
      logger.warn(
        formatMessage(
          formatAccountPrefix(this.accountIndex),
          "Connection closed"
        )
      );
      this.cleanup();
      this.handleReconnect();
    });

    this.ws.on("error", (error) => {
      logger.error(
        formatMessage(
          formatAccountPrefix(this.accountIndex),
          `WebSocket error: ${error}`
        )
      );
      this.cleanup();
      this.handleReconnect();
    });
  }

  handleConnectMessage(prefix, time, message) {
    logger.info(formatMessage(prefix, `Connected at ${time}`));
    logger.info(
      formatMessage(
        prefix,
        `Points Today: ${formatPoints(message.pointsToday)}`
      )
    );
    logger.info(
      formatMessage(
        prefix,
        `Total Points: ${formatPoints(message.pointsTotal)}`
      )
    );
  }

  handlePulseMessage(prefix, time, message) {
    logger.info(formatMessage(prefix, `Server pulse at ${time}`));
    logger.info(
      formatMessage(
        prefix,
        `Points Today: ${formatPoints(message.pointsToday)}`
      )
    );
    logger.info(
      formatMessage(
        prefix,
        `Total Points: ${formatPoints(message.pointsTotal)}`
      )
    );
  }

  startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        const pingMessage = {
          type: CONFIG.MESSAGE_TYPES.PING,
        };
        this.ws.send(JSON.stringify(pingMessage));
        const time = formatTime(new Date());
        logger.info(
          formatMessage(
            formatAccountPrefix(this.accountIndex),
            `Ping sent at ${time}`
          )
        );
      }
    }, CONFIG.WS.PING_INTERVAL);
  }

  cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  handleReconnect() {
    if (this.isRestarting) return;

    this.reconnectAttempts++;

    if (this.reconnectAttempts >= CONFIG.RECONNECT.ATTEMPTS_BEFORE_RESTART) {
      this.initiateAutoRestart();
      return;
    }

    const baseDelay = Math.min(
      CONFIG.RECONNECT.BASE_DELAY,
      CONFIG.RECONNECT.MAX_DELAY
    );
    const jitter = Math.floor(Math.random() * CONFIG.RECONNECT.JITTER);
    const delay = baseDelay + jitter;

    logger.warn(
      formatMessage(
        formatAccountPrefix(this.accountIndex),
        `Server unavailable. Attempt ${this.reconnectAttempts}/${
          CONFIG.RECONNECT.ATTEMPTS_BEFORE_RESTART
        }. Reconnecting in ${Math.floor(delay / 1000)} seconds...`
      )
    );

    setTimeout(() => this.connect(), delay);
  }

  initiateAutoRestart() {
    if (this.isRestarting) return;
    this.isRestarting = true;

    logger.warn(
      formatMessage(
        formatAccountPrefix(this.accountIndex),
        `Maximum reconnection attempts reached. Initiating auto-restart in 10 seconds...`
      )
    );

    this.cleanup();
    if (this.ws) {
      this.ws.close();
    }

    setTimeout(() => {
      logger.info("Restarting program...");
      restartProgram();
    }, 10000);
  }
}

async function startMultipleClients() {
  try {
    const data = await fs.promises.readFile(CONFIG.FILES.TOKEN_FILE, "utf8");
    const tokens = data.split("\n").filter((token) => token.trim() !== "");

    logger.info(`Starting ${tokens.length} WebSocket clients...`);

    const clients = tokens.map((token, index) => {
      const client = new WebSocketClient(token.trim(), index + 1);
      client.connect();
      return client;
    });

    process.on("SIGINT", () => {
      logger.warn("Terminating all connections...");
      clients.forEach((client, index) => {
        if (client.ws) {
          logger.warn(
            formatMessage(formatAccountPrefix(index + 1), "Closing connection")
          );
          client.cleanup();
          client.ws.close();
        }
      });
      process.exit(0);
    });
  } catch (error) {
    logger.error(`Error reading tokens file: ${error}`);
    process.exit(1);
  }
}

displayBanner();
startMultipleClients();
