const routes = {
  '/': renderHome,
  '/users': renderUsers,
  '/settings': renderSettings,
  '/admin': renderAdminPanel,
  '/create': renderCreatePost,
  '/logout': handleLogout,
};

window.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (routes[path]) routes[path]();
  else document.getElementById('app').innerHTML = '<h2>404 Not Found</h2>';
});

function renderHome() {
  fetch('/api/posts')
    .then(res => res.json())
    .then(posts => {
      const html = posts.map(post => `
        <div class="post">
          <a href="/post/${post.id}">${post.title}</a>
          <p>by <a href="/user/${post.author}">${post.author}</a></p>
          <small>Last Reply: ${post.last_reply}</small>
        </div>
      `).join('');
      document.getElementById('app').innerHTML = `<h2>Recent Posts</h2>${html}`;
    });
}

function renderUsers() {
  fetch('/api/users')
    .then(res => res.json())
    .then(users => {
      const html = users.map(user => `
        <div><a href="/user/${user.username}">${user.username}</a> ${user.badge}</div>
      `).join('');
      document.getElementById('app').innerHTML = `<h2>Users</h2>${html}`;
    });
}

function renderSettings() {
  fetch('/api/me')
    .then(res => res.json())
    .then(user => {
      document.getElementById('app').innerHTML = `
        <h2>Settings</h2>
        <form method="POST" action="/api/settings">
          <label>Password: <input type="password" name="password" /></label>
          <button type="submit">Update</button>
        </form>
      `;
    });
}

function renderAdminPanel() {
  fetch('/api/admin')
    .then(res => res.json())
    .then(data => {
      document.getElementById('app').innerHTML = `
        <h2>Admin Panel</h2>
        <div>Accounts: ${data.users}</div>
        <div>Posts: ${data.posts}</div>
      `;
    });
}

function renderCreatePost() {
  document.getElementById('app').innerHTML = `
    <h2>New Post</h2>
    <form id="postForm">
      <input name="title" placeholder="Post title" required><br>
      <textarea name="desc" placeholder="Write something..." required></textarea><br>
      <button>Create</button>
    </form>
  `;
  document.getElementById('postForm').onsubmit = async e => {
    e.preventDefault();
    const form = new FormData(e.target);
    const res = await fetch('/api/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.get('title'),
        desc: form.get('desc'),
        date: new Date().toISOString()
      })
    });
    const post = await res.json();
    if (post.id) window.location.href = `/post/${post.id}`;
  };
}

function handleLogout() {
  fetch('/api/logout', { method: 'POST' })
    .then(() => window.location.href = '/')
    .catch(err => console.error('Logout failed:', err));
}
