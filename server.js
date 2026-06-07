const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// 🔓 FIXED CORS: Now accepts "null" from strict Perchance iframes
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || origin === 'null' || origin.endsWith('.perchance.org') || origin === 'https://perchance.org') {
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
      if (!origin || origin === 'null' || origin.endsWith('.perchance.org') || origin === 'https://perchance.org') {
        callback(null, true);
      } else {
        callback(new Error('Blocked by secure backend CORS'));
      }
    },
    methods: ["GET", "POST"]
  }
});

const activeUsers = new Map(); 

io.on('connection', (socket) => {
  // IP limit temporarily removed for testing!
  
  socket.on('join_counter', (data) => {
    activeUsers.set(socket.id, {
      countryName: data.countryName || 'Unknown',
      countryCode: data.countryCode || 'un'
    });
    broadcastUpdate();
  });

  socket.on('disconnect', () => {
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
