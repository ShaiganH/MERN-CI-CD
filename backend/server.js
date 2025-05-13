import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

dotenv.config();
const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
console.log("MongoDB connected");

// ====== MODELS ======

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
});

const taskSchema = new mongoose.Schema({
  userId: mongoose.Types.ObjectId,
  title: String,
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);
const Task = mongoose.model('Task', taskSchema);

// ====== AUTH ROUTES ======

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  try {
    const user = new User({ username, password: hash });
    await user.save();
    res.json({ message: 'User registered' });
  } catch {
    res.status(400).json({ message: 'User already exists' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(401).json({ message: 'User not found' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: 'Invalid password' });

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
  res.json({ token });
});

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(403).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// ====== TASK ROUTES ======

app.get('/tasks', authMiddleware, async (req, res) => {
  const tasks = await Task.find({ userId: req.user.userId }).sort({ createdAt: -1 });
  res.json(tasks);
});

app.post('/tasks', authMiddleware, async (req, res) => {
  const { title } = req.body;
  const task = new Task({ userId: req.user.userId, title });
  await task.save();
  res.json(task);
});

app.put('/tasks/:id', authMiddleware, async (req, res) => {
  const { completed } = req.body;
  await Task.updateOne(
    { _id: req.params.id, userId: req.user.userId },
    { $set: { completed } }
  );
  res.json({ message: 'Task updated' });
});

app.delete('/tasks/:id', authMiddleware, async (req, res) => {
  await Task.deleteOne({ _id: req.params.id, userId: req.user.userId });
  res.json({ message: 'Task deleted' });
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
