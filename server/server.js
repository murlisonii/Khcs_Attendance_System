const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const attendanceRoutes = require('./routes/attendance');
const labelRoutes = require('./routes/labels');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/auth');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

//const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/attendancedb';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://host.docker.internal:27017/attendancedb';

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use('/api/attendance', attendanceRoutes);
app.use('/api/labels', labelRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => res.json({ ok: true, message: 'Attendance backend running' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
