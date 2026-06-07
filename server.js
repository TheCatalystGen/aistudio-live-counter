const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// 🔒 SECURITY LAYER 1: Hardcoded CORS to your Ai Studio Sandbox
const allowedOrigins = [
  "https://perchance.org",
  "https://e4c355945691054b89b23a0133098083.perchance.org"
];

app.use(cors({ origin: allowedOrigins }));

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

// In-Memory Database (Fast, clears if server restarts)
const activeUsers = new Map(); // Maps socket ID to country data
const ipConnectionCounts = new Map(); // Maps IP address to connection count

// 🔒 SECURITY LAYER 2: Troll Protection (Max 3 connections per household/IP)
const MAX_CONNECTIONS_PER_IP = 3; 

io.on('connection', (socket) => {
  
  // 1. Grab the user's real IP address (Render passes this in headers)
  let userIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  if (typeof userIp === 'string' && userIp.includes(',')) {
      userIp = userIp.split(',')[0].trim();
  }

  let currentIpCount = ipConnectionCounts.get(userIp) || 0;

  // 2. Block the connection if they exceed the limit
  if (currentIpCount >= MAX_CONNECTIONS_PER_IP) {
    console.warn(`[SECURITY] Blocked excess connection from IP: ${userIp}`);
    socket.disconnect(true);
    return;
  }

  // 3. Allow connection and increment their IP count
  ipConnectionCounts.set(userIp, currentIpCount + 1);

  // 4. Listen for the HTML frontend sending their country data
  socket.on('join_counter', (data) => {
    activeUsers.set(socket.id, {
      countryName: data.countryName || 'Unknown',
      countryCode: data.countryCode || 'un'
    });
    broadcastUpdate();
  });

  // 5. Clean up when someone closes the tab
  socket.on('disconnect', () => {
    // Reduce their IP count
    let count = ipConnectionCounts.get(userIp) || 0;
    if (count > 1) {
      ipConnectionCounts.set(userIp, count - 1);
    } else {
      ipConnectionCounts.delete(userIp);
    }

    // Remove from the active user list
    activeUsers.delete(socket.id);
    broadcastUpdate();
  });
});

// Function to broadcast the total list of users to everyone connected
function broadcastUpdate() {
  const usersArray = Array.from(activeUsers.values());
  io.emit('counter_update', usersArray);
}

// Health check endpoint so Render knows the server is online
app.get('/', (req, res) => {
  res.send('Ai Studio Live Counter Backend is Securely Running.');
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server locked and listening on port ${PORT}`);
});
