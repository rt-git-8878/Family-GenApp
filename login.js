document.addEventListener('DOMContentLoaded', function() {
  // Always show login section on page load (force login)
  hideMainContent();

  // Login button event
  document.getElementById('loginBtn').addEventListener('click', function() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // Fetch credentials from JSON file
    fetch('https://api.jsonbin.io/v3/b/68bbf86ad0ea881f4073aef9', {
      headers: {
        'X-Master-Key': '$2a$10$zd5OnnzULMOHwt53g09IGOVReBWUY4QORY1bHHV/P4cZ.i06kcxLO'
      }
    })
      .then(response => response.json())
      .then(data => {
        const credentials = data.record;
        if (username === credentials.username && password === credentials.password) {
          // Login successful
          localStorage.setItem('loggedIn', 'true');
          showMainContent();
        } else {
          // Login failed
          document.getElementById('errorMessage').style.display = 'block';
        }
      })
      .catch(error => {
        console.error('Error loading credentials:', error);
        // Fallback for demo purposes
        if (username === 'admin' && password === 'password123') {
          localStorage.setItem('loggedIn', 'true');
          showMainContent();
        } else {
          document.getElementById('errorMessage').style.display = 'block';
        }
      });
  });
  
  // Logout button event
  document.getElementById('logoutBtn').addEventListener('click', function() {
    localStorage.removeItem('loggedIn');
    hideMainContent();
  });
  
  function showMainContent() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'block';
    
    // Remove scroll prevention class
    document.body.classList.remove('login-visible');

    // Trigger toggleView and initialize tree after showing main content
    setTimeout(() => {
      if (typeof toggleView === 'function') {
        toggleView();
      }
      if (typeof window.initTree === 'function') {
        window.initTree();
      }
    }, 100);
  }
  
  function hideMainContent() {
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('errorMessage').style.display = 'none';
    
    // Add scroll prevention class
    document.body.classList.add('login-visible');
  }
});
