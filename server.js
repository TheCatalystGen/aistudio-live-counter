const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// 🔒 BULLETPROOF CORS: Dynamically allows any Perchance page but blocks everything else
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || origin.endsWith('.perchance.org') || origin === 'https://perchance.org') {
      callback(null, true);
    } else {
      callback(new Error('Blocked by secure backend CORS'));
    }
  }
};

app.use(cors(corsOptions));

const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin || origin.endsWith('.perchance.org') || origin === 'https://perchance.org') {
        callback(null, true);
      } else {
        callback(new Error('Blocked by secure backend CORS'));
      }
    },
    methods: ["GET", "POST"]
  }
});

const activeUsers = new Map(); 
const ipConnectionCounts = new Map(); 

const MAX_CONNECTIONS_PER_IP = 3; 

io.on('connection', (socket) => {
  let userIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  if (typeof userIp === 'string' && userIp.includes(',')) {
      userIp = userIp.split(',')[0].trim();
  }

  let currentIpCount = ipConnectionCounts.get(userIp) || 0;

  if (currentIpCount >= MAX_CONNECTIONS_PER_IP) {
    socket.disconnect(true);
    return;
  }

  ipConnectionCounts.set(userIp, currentIpCount + 1);

  socket.on('join_counter', (data) => {
    activeUsers.set(socket.id, {
      countryName: data.countryName || 'Unknown',
      countryCode: data.countryCode || 'un'
    });
    broadcastUpdate();
  });

  socket.on('disconnect', () => {
    let count = ipConnectionCounts.get(userIp) || 0;
    if (count > 1) {
      ipConnectionCounts.set(userIp, count - 1);
    } else {
      ipConnectionCounts.delete(userIp);
    }
    activeUsers.delete(socket.id);
    broadcastUpdate();
  });
});

function broadcastUpdate() {
  const usersArray = Array.from(activeUsers.values());
  io.emit('counter_update', usersArray);
}

app.get('/', (req, res) => {
  res.send('Ai Studio Live Counter Backend is Securely Running.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server locked and listening on port ${PORT}`);
});
