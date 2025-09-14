function buildTree(data) {
  const ul = document.createElement('ul');
  ul.classList.add('tree');

  data.forEach(item => {
    const li = document.createElement('li');
    const name = item.text.name;

    if (item.children && item.children.length > 0) {
      const span = document.createElement('span');
      span.classList.add('caret');
      span.textContent = name;
      span.onclick = function() {
        this.parentElement.querySelector(".nested").classList.toggle("active");
        this.classList.toggle("caret-down");
      };
      li.appendChild(span);

      const childrenUl = buildTree(item.children);
      childrenUl.classList.add('nested');
      li.appendChild(childrenUl);
    } else {
      li.textContent = name;
    }

    ul.appendChild(li);
  });

  return ul;
}
//=============  For local Json testing==============
// fetch('tree.json')
//   .then(response => response.json())
//   .then(data => {
//     document.getElementById('list-simple').innerHTML = '';
//     const tree = buildTree(data);
//     document.getElementById('list-simple').appendChild(tree);
//   })
  // Uncomment below code and comment above local json code block to fetch from online source
  
  //============= For online Json testing==============
fetch('https://api.jsonbin.io/v3/b/68bbe92943b1c97be938b7fc', {
  headers: {
    'X-Master-Key': '$2a$10$zd5OnnzULMOHwt53g09IGOVReBWUY4QORY1bHHV/P4cZ.i06kcxLO'
  }
})
  .then(response => response.json())
  .then(data => {
    const treeData = data.record;
    document.getElementById('list-simple').innerHTML = '';
    const tree = buildTree(treeData);
    document.getElementById('list-simple').appendChild(tree);
  })
   //============= For online Json testing==============
  .catch(error => {
    console.error('Error loading tree:', error);
    document.getElementById('list-simple').textContent = 'Failed to load data.';
  });


function toggleView() {
  const treeView = document.getElementById('treeView').checked;
  const listSimple = document.getElementById('list-simple');
  const treeSimple = document.getElementById('tree-simple');

  // Stylesheet link elements
  const styleCss = document.getElementById('styleCss');
  const customCss = document.getElementById('customCss');

  if (treeView) {
    treeSimple.style.display = 'block';
    listSimple.style.display = 'none';

    // Enable custom.css and disable style.css
    customCss.disabled = false;
    styleCss.disabled = true;

    // Remove list-view class from body
    document.body.classList.remove('list-view');
  } else {
    treeSimple.style.display = 'none';
    listSimple.style.display = 'block';

    // Enable style.css and disable custom.css
    styleCss.disabled = false;
    customCss.disabled = true;

    // Add list-view class to body
    document.body.classList.add('list-view');
  }
}

function highlightListNode(name) {
  // Function removed as per user request
}

// Expose highlightListNode globally
window.highlightListNode = highlightListNode;

// Add event listeners to radio buttons
document.getElementById('treeView').addEventListener('change', (event) => {
  event.preventDefault();
  toggleView();
});
document.getElementById('listView').addEventListener('change', (event) => {
  event.preventDefault();
  toggleView();
});

// Initialize view on page load
window.addEventListener('DOMContentLoaded', () => {
  toggleView();
});