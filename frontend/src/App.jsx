import React, { useState, useEffect } from "react";
import axios from "axios";

// === CONFIG ===
const API = "https://anti-phishing-forum-backend.onrender.com/api";

// === Helpers ===
function timeAgo(date) {
  const d = new Date(date);
  const now = new Date();
  const secs = Math.floor((now - d) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs/3600)}h ago`;
  return d.toLocaleString();
}

// === Auth context (2012 style: localStorage) ===
const AuthContext = React.createContext();

function AuthProvider({ children }) {
  const [user, setUser] = useState(() =>
    localStorage.getItem("token")
      ? { username: localStorage.getItem("username"), token: localStorage.getItem("token") }
      : null
  );

  function login(u, t) {
    localStorage.setItem("username", u);
    localStorage.setItem("token", t);
    setUser({ username: u, token: t });
  }
  function logout() {
    localStorage.removeItem("username");
    localStorage.removeItem("token");
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

// === Main App ===
export default function App() {
  return (
    <AuthProvider>
      <Forum />
    </AuthProvider>
  );
}

// === Forum ===
function Forum() {
  const [page, setPage] = useState("main");
  const [selected, setSelected] = useState(null); // post id or username
  const [refresh, setRefresh] = useState(0);

  function go(p, s=null) { setPage(p); setSelected(s); }
  function reload() { setRefresh(r => r+1); }

  return (
    <>
      <Header go={go} />
      <OnlineUsers />
      {page === "main" && <PostList go={go} />}
      {page === "post" && <PostPage postId={selected} go={go} />}
      {page === "profile" && <ProfilePage username={selected} go={go} />}
      {page === "login" && <LoginForm go={go} />}
      {page === "register" && <RegisterForm go={go} />}
      {page === "new" && <NewPostForm go={go} reload={reload} />}
      <footer>Retro Forum &copy; 2012-2025</footer>
    </>
  );
}

// === Header/Nav ===
function Header({ go }) {
  const { user, logout } = React.useContext(AuthContext);
  return (
    <header>
      <h1 style={{margin:0, fontSize: "1.3em", letterSpacing:".03em"}}>Retro Forum</h1>
      <nav>
        <a href="#" onClick={e => {e.preventDefault(); go("main");}}>Home</a>
        {user && <>
          <a href="#" onClick={e => {e.preventDefault(); go("new");}}>New Post</a>
          <a href="#" onClick={e => {e.preventDefault(); go("profile", user.username);}}>My Profile</a>
        </>}
        {!user && <>
          <a href="#" onClick={e => {e.preventDefault(); go("login");}}>Login</a>
          <a href="#" onClick={e => {e.preventDefault(); go("register");}}>Register</a>
        </>}
        {user && <span style={{marginLeft:18, color:"#888"}}>Hi, {user.username} <button style={{padding:"2px 7px", fontSize:".93em"}} onClick={logout}>Logout</button></span>}
      </nav>
    </header>
  );
}

// === Who's Online ===
function OnlineUsers() {
  const [online, setOnline] = useState([]);
  useEffect(() => {
    axios.get(`${API}/online`).then(r => setOnline(r.data));
    const t = setInterval(() => axios.get(`${API}/online`).then(r => setOnline(r.data)), 20000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="online-users"><b>Online:</b> {online.length ? online.join(", ") : "Nobody :("}</div>
  );
}

// === Post List ===
function PostList({ go }) {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  useEffect(() => {
    axios.get(`${API}/posts?page=${page}`).then(r => {
      setPosts(r.data.posts);
      setPageCount(r.data.pageCount);
    });
  }, [page]);
  return (
    <>
      <ul className="forum-list">
        {posts.map(post =>
          <li key={post._id}>
            <a href="#" className="post-title" onClick={e => {e.preventDefault(); go("post", post._id);}}>{post.title}</a>
            <div>
              <span>by <a href="#" onClick={e => {e.preventDefault(); go("profile", post.author.username);}}>{post.author.username}</a></span>
              <span style={{marginLeft:16, color:"#888"}}>{timeAgo(post.createdAt)}</span>
            </div>
          </li>
        )}
      </ul>
      <div>
        {page > 1 && <button onClick={() => setPage(page-1)}>Prev</button>}
        <span style={{margin:"0 12px"}}>Page {page}/{pageCount}</span>
        {page < pageCount && <button onClick={() => setPage(page+1)}>Next</button>}
      </div>
    </>
  );
}

// === Single Post Page (+ replies) ===
function PostPage({ postId, go }) {
  const { user } = React.useContext(AuthContext);
  const [post, setPost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [reply, setReply] = useState("");
  const [edit, setEdit] = useState(null); // {type: "post"|"reply", id: ...}
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    axios.get(`${API}/posts/${postId}`).then(r => {
      setPost(r.data.post);
      setReplies(r.data.replies);
    });
  }, [postId, refresh]);

  async function submitReply(e) {
    e.preventDefault();
    if (!reply) return;
    try {
      await axios.post(`${API}/posts/${postId}/replies`, { content: reply }, {
        headers: { Authorization: "Bearer " + user.token }
      });
      setReply("");
      setRefresh(r => r+1);
    } catch {
      alert("Login to reply.");
    }
  }

  async function deletePost() {
    if (!window.confirm("Delete this post?")) return;
    await axios.delete(`${API}/posts/${postId}`, {
      headers: { Authorization: "Bearer " + user.token }
    });
    go("main");
  }

  async function submitEditPost(e) {
    e.preventDefault();
    await axios.put(`${API}/posts/${postId}`, { title: post.title, content: post.content }, {
      headers: { Authorization: "Bearer " + user.token }
    });
    setEdit(null);
    setRefresh(r => r+1);
  }

  async function deleteReply(id) {
    if (!window.confirm("Delete this reply?")) return;
    await axios.delete(`${API}/replies/${id}`, {
      headers: { Authorization: "Bearer " + user.token }
    });
    setRefresh(r => r+1);
  }

  async function submitEditReply(e, id, content) {
    e.preventDefault();
    await axios.put(`${API}/replies/${id}`, { content }, {
      headers: { Authorization: "Bearer " + user.token }
    });
    setEdit(null);
    setRefresh(r => r+1);
  }

  if (!post) return <p>Loading...</p>;
  return (
    <>
      <h2 style={{marginBottom:0}}>{edit?.type==="post"
        ? <input value={post.title} onChange={e => setPost({...post, title: e.target.value})} />
        : post.title}</h2>
      <div style={{marginBottom:10}}>
        by <a href="#" onClick={e => {e.preventDefault(); go("profile", post.author.username);}}>{post.author.username}</a>
        <span style={{color:"#888", marginLeft:10}}>{timeAgo(post.createdAt)}</span>
      </div>
      <div>
        {edit?.type==="post"
          ? <form onSubmit={submitEditPost}>
              <textarea value={post.content} onChange={e => setPost({...post, content: e.target.value})} />
              <button type="submit">Save</button>
              <button type="button" onClick={() => setEdit(null)}>Cancel</button>
            </form>
          : <div style={{whiteSpace:"pre-wrap"}}>{post.content}</div>
        }
      </div>
      {user && post.author.username === user.username && !edit &&
        <div style={{margin:"12px 0"}}>
          <button onClick={() => setEdit({type:"post"})}>Edit Post</button>
          <button onClick={deletePost}>Delete Post</button>
        </div>
      }
      <h3 style={{marginTop:30}}>Replies</h3>
      {replies.map(r =>
        <div className="reply-box" key={r._id}>
          <div>
            <span className="reply-author">{r.author.username}</span>
            <span className="reply-date">{timeAgo(r.createdAt)}</span>
            {user && r.author.username === user.username && !edit &&
              <>
                <button style={{marginLeft:12, fontSize:".92em"}} onClick={() => setEdit({type:"reply", id:r._id})}>Edit</button>
                <button style={{marginLeft:7, fontSize:".92em"}} onClick={() => deleteReply(r._id)}>Delete</button>
              </>
            }
          </div>
          {edit?.type==="reply" && edit.id===r._id
            ? <form onSubmit={e => submitEditReply(e, r._id, r.content)}>
                <textarea value={r.content} onChange={e => {
                  setReplies(rs => rs.map(x => x._id===r._id ? {...x, content:e.target.value} : x));
                }} />
                <button type="submit">Save</button>
                <button type="button" onClick={() => setEdit(null)}>Cancel</button>
              </form>
            : <div style={{whiteSpace:"pre-wrap", marginTop:5}}>{r.content}</div>
          }
        </div>
      )}
      {user ? (
        <form onSubmit={submitReply}>
          <textarea required placeholder="Your reply..." value={reply} onChange={e => setReply(e.target.value)} />
          <button type="submit">Reply</button>
        </form>
      ) : <div style={{marginTop:12, color:"#3262a8"}}>Log in to reply.</div>}
      <button style={{marginTop:20}} onClick={()=>go("main")}>Back to Forum</button>
    </>
  );
}

// === New Post ===
function NewPostForm({ go, reload }) {
  const { user } = React.useContext(AuthContext);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  async function submit(e) {
    e.preventDefault();
    try {
      await axios.post(`${API}/posts`, { title, content }, { headers: { Authorization: "Bearer " + user.token } });
      reload();
      go("main");
    } catch {
      alert("Error: must be logged in.");
    }
  }
  return (
    <form onSubmit={submit}>
      <h2>New Post</h2>
      <input required placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
      <textarea required placeholder="Content" value={content} onChange={e => setContent(e.target.value)} />
      <button type="submit">Post</button>
      <button type="button" onClick={()=>go("main")}>Cancel</button>
    </form>
  );
}

// === User Profile ===
function ProfilePage({ username, go }) {
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    axios.get(`${API}/user/${username}`).then(r => setProfile(r.data));
  }, [username]);
  if (!profile) return <div>Loading...</div>;
  return (
    <>
      <div className="profile-box">
        <h2>{profile.username}</h2>
        <div>Joined: {new Date(profile.joined).toLocaleDateString()}</div>
        {profile.email && <div>Email: {profile.email}</div>}
      </div>
      <h3>Posts by {profile.username}</h3>
      <ul className="forum-list">
        {profile.posts.map(p =>
          <li key={p._id}>
            <a href="#" className="post-title" onClick={e => {e.preventDefault(); go("post", p._id);}}>{p.title}</a>
            <span style={{marginLeft:12, color:"#888"}}>{timeAgo(p.createdAt)}</span>
          </li>
        )}
      </ul>
      <button onClick={()=>go("main")}>Back to Forum</button>
    </>
  );
}

// === Login/Register ===
function LoginForm({ go }) {
  const { login } = React.useContext(AuthContext);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  async function submit(e) {
    e.preventDefault();
    try {
      const r = await axios.post(`${API}/login`, { username, password });
      login(r.data.username, r.data.token);
      go("main");
    } catch (e) {
      setErr(e.response?.data?.error || "Login failed.");
    }
  }
  return (
    <form onSubmit={submit}>
      <h2>Login</h2>
      {err && <div style={{color:"red"}}>{err}</div>}
      <input required placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
      <input required type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      <button type="submit">Login</button>
      <button type="button" onClick={()=>go("main")}>Cancel</button>
    </form>
  );
}

function RegisterForm({ go }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  async function submit(e) {
    e.preventDefault();
    try {
      await axios.post(`${API}/register`, { username, email, password });
      alert("Registered! Please login.");
      go("login");
    } catch (e) {
      setErr(e.response?.data?.error || "Registration failed.");
    }
  }
  return (
    <form onSubmit={submit}>
      <h2>Register</h2>
      {err && <div style={{color:"red"}}>{err}</div>}
      <input required placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
      <input placeholder="Email (optional)" value={email} onChange={e => setEmail(e.target.value)} />
      <input required type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      <button type="submit">Register</button>
      <button type="button" onClick={()=>go("main")}>Cancel</button>
    </form>
  );
}
