const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// 🔒 STRICT CORS: VIP list only
const allowedOrigins = [
  'https://perchance.org',
  'https://e4c355945691054b89b23a0133098083.perchance.org',
  'null' // Required so Perchance iframes don't break
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
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
      if (!origin || allowedOrigins.includes(origin)) {
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
