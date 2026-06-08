const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// 🔒 ULTRA-STRICT CORS: Secret link and required iframes only
const allowedOrigins = [
  'https://e4c355945691054b89b23a0133098083.perchance.org',
  'null' 
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
let dailyPeak = 0; 
let allTimePeak = 0;

// 🛡️ THE LAZY DATABASE INITIALIZATION
async function initDatabase() {
  if (!process.env.UPSTASH_URL || !process.env.UPSTASH_TOKEN) {
    console.log("No database keys found. Running in RAM-only mode.");
    return;
  }
  
  try {
    const res = await fetch(`${process.env.UPSTASH_URL}/get/aistudio_all_time_peak`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_TOKEN}` }
    });
    const data = await res.json();
    if (data.result) {
      allTimePeak = parseInt(data.result);
      console.log(`Database Connected. All-Time Peak Loaded: ${allTimePeak}`);
    }
  } catch (e) {
    console.error("Database connection error on boot.");
  }
}

initDatabase();

io.on('connection', (socket) => {
  
  socket.on('join_counter', (data) => {
    activeUsers.set(socket.id, {
      countryName: data.countryName || 'Unknown',
      countryCode: data.countryCode || 'un'
    });
    
    const currentCount = activeUsers.size;

    if (currentCount > dailyPeak) {
      dailyPeak = currentCount;
    }
    
    if (currentCount > allTimePeak) {
      allTimePeak = currentCount;
      
      if (process.env.UPSTASH_URL && process.env.UPSTASH_TOKEN) {
        fetch(`${process.env.UPSTASH_URL}/set/aistudio_all_time_peak/${allTimePeak}`, {
          headers: { Authorization: `Bearer ${process.env.UPSTASH_TOKEN}` }
        }).catch(err => console.error("Database write error."));
      }
    }
    
    broadcastUpdate();
  });

  socket.on('disconnect', () => {
    activeUsers.delete(socket.id);
    broadcastUpdate();
  });
});

function broadcastUpdate() {
  const usersArray = Array.from(activeUsers.values());
  io.emit('counter_update', {
    activeList: usersArray,
    peakCount: dailyPeak,
    allTimeCount: allTimePeak
  });
}

app.get('/', (req, res) => {
  res.send('Ai Studio Live Counter Backend is Securely Running.');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server locked and listening on port ${PORT}`);
});
