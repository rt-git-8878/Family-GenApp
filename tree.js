//const IMAGE_URL = "https://cdn.pixabay.com/photo/2020/07/14/13/07/icon-5404125_1280.png";
const IMAGE_URL="Images\\No_Photo.png";
function createNodeHTML(node) {
  const name = node.text.name || "";
  const title = node.text.title || "";
  const contact = node.text.contact || "";
  const link = node.text.link || "";

  let contactHTML = contact ? `<div class="node-contact">${contact}</div>` : "";
  let linkHTML = link ? `<a href="${link}" class="node-link" target="_blank">${name}</a>` : name;

  return `
    <div class="node-content" style="text-align:center; display:flex; flex-direction: column; align-items: center;">
      <img src="${IMAGE_URL}" alt="${name}" style="display:block !important; margin: 0 auto 10px auto !important;" />
      <div class="node-text" style="text-align:center;">
        <div class="node-name">${linkHTML}</div>
        <div class="node-title">${title}</div>
        ${contactHTML}
      </div>
    </div>
  `;
}

function processNodes(nodes) {
  nodes.forEach(node => {
    node.innerHTML = createNodeHTML(node);

    // Assign class based on title keywords for background color
    if (node.text.title) {
      if (node.text.title.toLowerCase().includes("chief executive")) {
        node.HTMLclass = "ceo";
      } else if (node.text.title.toLowerCase().includes("technology")) {
        node.HTMLclass = "cto";
      } else if (node.text.title.toLowerCase().includes("business")) {
        node.HTMLclass = "cbo";
      } else if (node.text.title.toLowerCase().includes("accounting")) {
        node.HTMLclass = "cao";
      } else {
        node.HTMLclass = "node";
      }
    } else {
      node.HTMLclass = "node";
    }

    if (node.children) {
      processNodes(node.children);
    }
  });
}
function initTree() {
  //=============  For local Json testing==============
    //  fetch('tree.json')   
    // .then(res => res.json())
    // .then(data => {
    // const treeData = data;  
  //============= For local Json testing==============
  
  // Uncomment below code and comment above local json code block to fetch from online source
  
  //============= For online Json testing==============
  fetch('https://api.jsonbin.io/v3/b/68bbe92943b1c97be938b7fc', {
    headers: {
      'X-Master-Key': '$2a$10$zd5OnnzULMOHwt53g09IGOVReBWUY4QORY1bHHV/P4cZ.i06kcxLO'
    }
  })
    .then(res => res.json())
    .then(data => {
      const treeData = data.record; 
  //============= For online Json testing==============
      window.treeData = treeData;
      
      populateDropdown(treeData);
      if (treeData.length === 1) {
        processNodes([treeData[0]]);
        const chart_config = {
          chart: {
            container: "#tree-simple",
            connectors: { type: 'step' },
            animation: { nodeAnimation: "easeOutBounce", nodeSpeed: 700 },
            nodeSpacing: 40,
            siblingSeparation: 30,
            subTeeSeparation: 30,
            levelSeparation: 50
          },
          nodeStructure: treeData[0]
        };
        const chart = new Treant(chart_config);
        addNodeClickEvents();
      } else {
        processNodes(treeData);
        const chart_config = {
          chart: {
            container: "#tree-simple",
            connectors: { type: 'step' },
            animation: { nodeAnimation: "easeOutBounce", nodeSpeed: 700 },
            nodeSpacing: 40,
            siblingSeparation: 30,
            subTeeSeparation: 30,
            levelSeparation: 50
          },
          nodeStructure: { text: { name: "Family" }, children: treeData }
        };
        const chart = new Treant(chart_config);
        addNodeClickEvents();
      }
    });
}

// Helper function to find node data by name
function findNodeDataByName(name) {
  // Get the tree data from the global scope
  let treeData = window.treeData || [];
  
  function searchNode(nodes) {
    for (let node of nodes) {
      if (node.text && node.text.name === name) {
        return node;
      }
      if (node.children) {
        const found = searchNode(node.children);
        if (found) return found;
      }
    }
    return null;
  }
  
  return searchNode(treeData);
}

window.initTree = initTree;

function populateDropdown(treeData) {
  const select = document.getElementById('nodeSelect');
  const names = [];

  function traverse(nodes) {
    nodes.forEach(node => {
      if (node.text && node.text.name) {
        names.push(node.text.name);
      }
      if (node.children) {
        traverse(node.children);
      }
    });
  }
  traverse(treeData);

  names.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });

  select.addEventListener('change', () => {
    const selectedName = select.value;
    highlightNode(selectedName);

    // Also expand and focus in list view if visible
    if (document.getElementById('listView').checked) {
      if (window.expandAndFocusListNode) {
        window.expandAndFocusListNode(selectedName);
      }
    }
  });
}

function highlightNode(name) {
  // Remove existing highlights
  document.querySelectorAll('.node-highlight').forEach(el => {
    el.classList.remove('node-highlight');
  });

  if (!name) return;

  // Find node with matching name
  const nodes = document.querySelectorAll('.node');
  for (const node of nodes) {
    const nodeName = node.querySelector('.node-name')?.textContent || '';
    if (nodeName === name) {
      node.classList.add('node-highlight');
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      break;
    }
  }
}

function addNodeClickEvents() {
  // Wait a bit to ensure nodes are rendered
  setTimeout(() => {
    const nodes = document.querySelectorAll('.node');
    nodes.forEach(node => {
      node.style.cursor = 'pointer';
      node.addEventListener('click', () => {
        // Find the corresponding node data to check for DOB
        const nodeName = node.querySelector('.node-name')?.textContent || '';
        const nodeData = findNodeDataByName(nodeName);
        
        // Only show modal if node has DOB
        if (nodeData && nodeData.text) {
          const name = nodeData.text.name || '';
          const title = nodeData.text.title || '';
          const contact = nodeData.text.contact || '';
          const dob = nodeData.text.DOB || 'उपलब्ध नहीं है|';
          const imgSrc = node.querySelector('img')?.src || '';

          const modalBody = document.getElementById('modalBody');
          modalBody.innerHTML = `
            <img src="${imgSrc}" alt="${name}" style="width:100px; height:100px; border-radius:50%; display:block; margin: 0 auto 10px auto;" />
            <h2 style="text-align:center;">${name}</h2>
            <p style="text-align:center; font-style: italic;">${title}</p>
            ${contact ? `<p style="text-align:center;"><strong>Contact:</strong> ${contact}</p>` : ''}
            <p style="text-align:center; font-size: 1.2em; color: #007bff;"><strong>जन्म तिथि:</strong> ${dob}</p>
          `;

          const modal = document.getElementById('nodeModal');
          modal.style.display = 'block';
        }
      });
    });

    // Close modal on close button click
    const closeBtn = document.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => {
      const modal = document.getElementById('nodeModal');
      modal.style.display = 'none';
    });

    // Close modal on outside click
    window.addEventListener('click', (event) => {
      const modal = document.getElementById('nodeModal');
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    });
  }, 500);
}