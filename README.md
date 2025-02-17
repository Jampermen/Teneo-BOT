# Teneo WebSocket Bot

An automated WebSocket client for managing multiple Teneo accounts in parallel.

## Features

- Multi-account support
- Automatic ping and reconnection
- Clean and organized logging
- Easy account management
- Colorful console output

## Prerequisites

- Node.js (version 14 or higher)
- npm (Node Package Manager)
- Teneo browser extension with registration code: `VixZZ`

## Installation

1. Clone this repository:

```bash
git clone https://codeberg.org/Galkurta/Teneo-BOT.git
cd Teneo-Bot
```

2. Install dependencies:

```bash
npm install
```

## Configuration

### Getting JWT Token

1. Install Teneo browser extension
2. Register using code: `VixZZ`
3. Open extension
4. Right click > Inspect
5. Click Disconnect then Connect
6. Go to WS tab
7. Find and copy the value from the payload section

### Setting Up Accounts

1. Edit `data.txt` file in the root directory
2. Add JWT tokens (one per line) for each account

```
jwt_token_1
jwt_token_2
...
```

## Project Structure

```
project/
├── config/
│   ├── banner.js     # ASCII art banner configuration
│   ├── colors.js     # Console colors configuration
│   └── logger.js     # Winston logger configuration
├── main.js          # Main application file
├── data.txt         # JWT tokens storage
└── README.md        # Documentation
```

## Usage

Run the bot:

```bash
node main.js
```

The bot will:

- Display a welcome banner
- Connect to all accounts in parallel
- Send pings every 10 seconds
- Show real-time points updates
- Automatically reconnect on disconnection

## Features Details

### Auto-Reconnection

- Maximum 5 reconnection attempts
- Exponential backoff delay
- Maximum delay of 30 seconds

### Error Handling

- WebSocket connection errors
- Message parsing errors
- File reading errors
- Graceful shutdown on CTRL+C

## Contributing

Feel free to submit issues and enhancement requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This tool is for educational purposes only. Use at your own risk and responsibility.
