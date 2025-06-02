import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

// Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  email: String,
  lastActive: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});
const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title: String,
  content: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});
const replySchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  content: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});
const User = mongoose.model("User", userSchema);
const Post = mongoose.model("Post", postSchema);
const Reply = mongoose.model("Reply", replySchema);

// Middleware for JWT auth
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  jwt.verify(token, process.env.JWT_SECRET, (err, userInfo) => {
    if (err) return res.status(401).json({ error: "Invalid token" });
    req.user = userInfo;
    next();
  });
}

// Update lastActive
async function updateLastActive(req, res, next) {
  if (req.user?.id) {
    await User.findByIdAndUpdate(req.user.id, { lastActive: new Date() });
  }
  next();
}

// Auth routes
app.post("/api/register", async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Missing fields" });
  const hash = await bcrypt.hash(password, 10);
  try {
    const user = await User.create({ username, password: hash, email });
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: "Username taken" });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: "No such user" });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: "Wrong password" });
  const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET);
  await User.findByIdAndUpdate(user._id, { lastActive: new Date() });
  res.json({ token, username: user.username });
});

// Who's online (users active in last 10min)
app.get("/api/online", async (req, res) => {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  const users = await User.find({ lastActive: { $gte: tenMinAgo } }, "username");
  res.json(users.map(u => u.username));
});

// User profile
app.get("/api/user/:username", async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) return res.status(404).json({ error: "Not found" });
  const posts = await Post.find({ author: user._id }).sort({ createdAt: -1 });
  res.json({
    username: user.username,
    email: user.email,
    joined: user.createdAt,
    posts
  });
});

// List posts (pagination, newest first)
app.get("/api/posts", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const posts = await Post.find()
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("author", "username");
  const count = await Post.countDocuments();
  res.json({ posts, page, pageCount: Math.ceil(count / limit) });
});

// Create post
app.post("/api/posts", authenticate, updateLastActive, async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: "Missing fields" });
  const post = await Post.create({ author: req.user.id, title, content });
  res.status(201).json(post);
});

// Edit post
app.put("/api/posts/:id", authenticate, updateLastActive, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "Not found" });
  if (String(post.author) !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  post.title = req.body.title || post.title;
  post.content = req.body.content || post.content;
  post.updatedAt = new Date();
  await post.save();
  res.json(post);
});

// Delete post
app.delete("/api/posts/:id", authenticate, updateLastActive, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "Not found" });
  if (String(post.author) !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  await Reply.deleteMany({ post: post._id });
  await post.deleteOne();
  res.json({ ok: true });
});

// Get single post + replies
app.get("/api/posts/:id", async (req, res) => {
  const post = await Post.findById(req.params.id).populate("author", "username");
  if (!post) return res.status(404).json({ error: "Not found" });
  const replies = await Reply.find({ post: post._id }).populate("author", "username").sort({ createdAt: 1 });
  res.json({ post, replies });
});

// Create reply
app.post("/api/posts/:id/replies", authenticate, updateLastActive, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "No post" });
  const reply = await Reply.create({
    post: post._id,
    author: req.user.id,
    content: req.body.content
  });
  res.status(201).json(reply);
});

// Edit reply
app.put("/api/replies/:replyId", authenticate, updateLastActive, async (req, res) => {
  const reply = await Reply.findById(req.params.replyId);
  if (!reply) return res.status(404).json({ error: "Not found" });
  if (String(reply.author) !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  reply.content = req.body.content || reply.content;
  reply.updatedAt = new Date();
  await reply.save();
  res.json(reply);
});

// Delete reply
app.delete("/api/replies/:replyId", authenticate, updateLastActive, async (req, res) => {
  const reply = await Reply.findById(req.params.replyId);
  if (!reply) return res.status(404).json({ error: "Not found" });
  if (String(reply.author) !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  await reply.deleteOne();
  res.json({ ok: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
