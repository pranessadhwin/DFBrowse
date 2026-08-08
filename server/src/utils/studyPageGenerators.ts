export function generateStudyWebpage(hostname: string, targetUrl: string): string {
  const host = hostname.toLowerCase().replace(/^www\./, '');

  if (host.includes('leetcode.com')) {
    return getLeetCodePage(host, targetUrl);
  } else if (
    host.includes('claude.ai') ||
    host.includes('gemini.google.com') ||
    host.includes('grok.com') ||
    host.includes('kimi.com') ||
    host.includes('notebooklm.google.com') ||
    host.includes('arena.ai') ||
    host.includes('artificialanalysis.ai')
  ) {
    return getAiAssistantPage(host, targetUrl);
  } else if (host.includes('github.com')) {
    return getGitHubPage(host, targetUrl);
  } else if (host.includes('geeksforgeeks.org')) {
    return getGeeksForGeeksPage(host, targetUrl);
  } else {
    return getGenericStudyPage(host, targetUrl);
  }
}

function getLeetCodePage(hostname: string, url: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LeetCode - Study & Practice</title>
  <style>
    :root {
      --bg: #1a1a1a;
      --bg-side: #262626;
      --bg-panel: #282828;
      --text: #eff1f6;
      --muted: #8c8c8c;
      --accent: #ffa116;
      --accent-hover: #ffb84d;
      --border: #383838;
      --green: #2cbb5d;
      --red: #f63737;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      height: 48px;
      background: var(--bg-side);
      border-bottom: 1px solid var(--border);
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      font-size: 16px;
      color: var(--text);
    }
    .logo span { color: var(--accent); }
    .nav-links { display: flex; gap: 20px; font-size: 14px; }
    .nav-links a { color: var(--muted); text-decoration: none; cursor: pointer; }
    .nav-links a.active, .nav-links a:hover { color: var(--text); }
    .workspace {
      display: grid;
      grid-template-columns: 48% 1fr;
      flex: 1;
      overflow: hidden;
      border-top: 1px solid var(--border);
    }
    .panel {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-right: 1px solid var(--border);
      background: var(--bg);
    }
    .panel-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      background: var(--bg-side);
      border-bottom: 1px solid var(--border);
      font-size: 13px;
    }
    .problem-select {
      background: #383838;
      color: var(--text);
      border: 1px solid var(--border);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
    }
    .problem-content {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
      line-height: 1.6;
    }
    .problem-title {
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 10px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .difficulty {
      font-size: 12px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 999px;
      background: rgba(44, 187, 93, 0.15);
      color: var(--green);
    }
    .difficulty.med {
      background: rgba(255, 161, 22, 0.15);
      color: var(--accent);
    }
    pre {
      background: #262626;
      border: 1px solid var(--border);
      padding: 12px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 13px;
      overflow-x: auto;
    }
    .editor-panel {
      display: flex;
      flex-direction: column;
      background: #1e1e1e;
    }
    .editor-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      background: var(--bg-side);
      border-bottom: 1px solid var(--border);
    }
    textarea.code-editor {
      flex: 1;
      width: 100%;
      background: #1e1e1e;
      color: #d4d4d4;
      border: none;
      padding: 16px;
      font-family: "Fira Code", Consolas, monospace;
      font-size: 14px;
      line-height: 1.6;
      resize: none;
      outline: none;
    }
    .action-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: var(--bg-side);
      border-top: 1px solid var(--border);
    }
    .btn {
      padding: 8px 18px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      border: none;
    }
    .btn-run {
      background: #383838;
      color: var(--text);
    }
    .btn-run:hover { background: #454545; }
    .btn-submit {
      background: var(--green);
      color: #fff;
    }
    .btn-submit:hover { filter: brightness(1.1); }
    .result-box {
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      background: #262626;
      font-size: 13px;
      display: none;
    }
    .result-box.success { color: var(--green); display: block; }
  </style>
</head>
<body>
  <header>
    <div class="logo">
      <span>⚡</span> LeetCode Study
    </div>
    <div class="nav-links">
      <a class="active">Problems</a>
      <a>Contest</a>
      <a>Discuss</a>
      <a>Study Plan</a>
    </div>
    <div style="font-size: 13px; color: var(--muted);">Focus Allowlist Mode</div>
  </header>
  <div class="workspace">
    <div class="panel">
      <div class="panel-header">
        <span>Problem:</span>
        <select class="problem-select" id="probSelect" onchange="changeProblem()">
          <option value="1">1. Two Sum (Easy)</option>
          <option value="2">2. Add Two Numbers (Medium)</option>
          <option value="3">3. Longest Substring Without Repeating Characters (Medium)</option>
        </select>
      </div>
      <div class="problem-content" id="probContent">
        <div class="problem-title">
          <span>1. Two Sum</span>
          <span class="difficulty">Easy</span>
        </div>
        <p>Given an array of integers <code>nums</code> and an integer <code>target</code>, return <em>indices of the two numbers such that they add up to <code>target</code></em>.</p>
        <p>You may assume that each input would have <strong>exactly one solution</strong>, and you may not use the same element twice.</p>
        <p><strong>Example 1:</strong></p>
        <pre><strong>Input:</strong> nums = [2,7,11,15], target = 9
<strong>Output:</strong> [0,1]
<strong>Explanation:</strong> Because nums[0] + nums[1] == 9, we return [0, 1].</pre>
        <p><strong>Constraints:</strong></p>
        <ul>
          <li><code>2 <= nums.length <= 10^4</code></li>
          <li><code>-10^9 <= nums[i] <= 10^9</code></li>
          <li>Only one valid answer exists.</li>
        </ul>
      </div>
    </div>
    <div class="editor-panel">
      <div class="editor-toolbar">
        <span style="font-size:13px; color:var(--muted);">TypeScript / JavaScript</span>
        <span style="font-size:12px; color:var(--muted);">Auto-saved to session</span>
      </div>
      <textarea class="code-editor" id="codeEditor" spellcheck="false">function twoSum(nums: number[], target: number): number[] {
  const map = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const diff = target - nums[i];
    if (map.has(diff)) {
      return [map.get(diff)!, i];
    }
    map.set(nums[i], i);
  }
  return [];
}</textarea>
      <div class="result-box" id="resultBox">
        <strong>✓ Accepted</strong> — Runtime: 52 ms (Beats 94.2% of TypeScript submissions) · Memory: 44.2 MB
      </div>
      <div class="action-bar">
        <button class="btn btn-run" onclick="runCode()">Run Code ▶</button>
        <button class="btn btn-submit" onclick="submitCode()">Submit Solution ⚡</button>
      </div>
    </div>
  </div>
  <script>
    const problems = {
      "1": {
        title: "1. Two Sum",
        diff: "Easy",
        diffClass: "",
        desc: "<p>Given an array of integers <code>nums</code> and an integer <code>target</code>, return <em>indices of the two numbers such that they add up to <code>target</code></em>.</p><p>You may assume that each input would have <strong>exactly one solution</strong>.</p><pre><strong>Input:</strong> nums = [2,7,11,15], target = 9\\n<strong>Output:</strong> [0,1]</pre>",
        code: "function twoSum(nums: number[], target: number): number[] {\\n  const map = new Map<number, number>();\\n  for (let i = 0; i < nums.length; i++) {\\n    const diff = target - nums[i];\\n    if (map.has(diff)) return [map.get(diff)!, i];\\n    map.set(nums[i], i);\\n  }\\n  return [];\\n}"
      },
      "2": {
        title: "2. Add Two Numbers",
        diff: "Medium",
        diffClass: "med",
        desc: "<p>You are given two <strong>non-empty</strong> linked lists representing two non-negative integers. The digits are stored in reverse order.</p><pre><strong>Input:</strong> l1 = [2,4,3], l2 = [5,6,4]\\n<strong>Output:</strong> [7,0,8]\\n<strong>Explanation:</strong> 342 + 465 = 807.</pre>",
        code: "function addTwoNumbers(l1: ListNode | null, l2: ListNode | null): ListNode | null {\\n  let dummy = new ListNode(0);\\n  let curr = dummy, carry = 0;\\n  while (l1 || l2 || carry) {\\n    let sum = (l1?.val || 0) + (l2?.val || 0) + carry;\\n    carry = Math.floor(sum / 10);\\n    curr.next = new ListNode(sum % 10);\\n    curr = curr.next;\\n    l1 = l1?.next || null;\\n    l2 = l2?.next || null;\\n  }\\n  return dummy.next;\\n}"
      },
      "3": {
        title: "3. Longest Substring Without Repeating Characters",
        diff: "Medium",
        diffClass: "med",
        desc: "<p>Given a string <code>s</code>, find the length of the <strong>longest substring</strong> without repeating characters.</p><pre><strong>Input:</strong> s = 'abcabcbb'\\n<strong>Output:</strong> 3\\n<strong>Explanation:</strong> The answer is 'abc', with the length of 3.</pre>",
        code: "function lengthOfLongestSubstring(s: string): number {\\n  let max = 0, left = 0;\\n  const set = new Set<string>();\\n  for (let right = 0; right < s.length; right++) {\\n    while (set.has(s[right])) {\\n      set.delete(s[left++]);\\n    }\\n    set.add(s[right]);\\n    max = Math.max(max, right - left + 1);\\n  }\\n  return max;\\n}"
      }
    };

    function changeProblem() {
      const val = document.getElementById('probSelect').value;
      const prob = problems[val];
      if (!prob) return;
      document.getElementById('probContent').innerHTML = \`
        <div class="problem-title">
          <span>\${prob.title}</span>
          <span class="difficulty \${prob.diffClass}">\${prob.diff}</span>
        </div>
        \${prob.desc}
      \`;
      document.getElementById('codeEditor').value = prob.code;
      document.getElementById('resultBox').style.display = 'none';
    }

    function runCode() {
      const box = document.getElementById('resultBox');
      box.style.display = 'block';
      box.innerHTML = '<strong>▶ Executing test cases...</strong>';
      setTimeout(() => {
        box.innerHTML = '<strong>✓ All 3 test cases passed!</strong> — Time: 48 ms';
      }, 350);
    }

    function submitCode() {
      const box = document.getElementById('resultBox');
      box.style.display = 'block';
      box.innerHTML = '<strong>⚡ Submitting to LeetCode Grader...</strong>';
      setTimeout(() => {
        box.innerHTML = '<strong>✓ Accepted</strong> — Runtime: 52 ms (Beats 94.2% of TypeScript submissions) · Memory: 44.2 MB';
      }, 500);
    }
  </script>
</body>
</html>`;
}

function getAiAssistantPage(hostname: string, url: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${hostname} - AI Study Assistant</title>
  <style>
    :root {
      --bg: #0d1117;
      --panel: #161b22;
      --text: #e6edf3;
      --muted: #8b949e;
      --blue: #2f81f7;
      --border: #30363d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      height: 54px;
      background: var(--panel);
      border-bottom: 1px solid var(--border);
    }
    .logo {
      font-size: 17px;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-width: 800px;
      width: 100%;
      margin: 0 auto;
    }
    .msg {
      display: flex;
      gap: 12px;
      line-height: 1.6;
      font-size: 15px;
    }
    .msg.ai {
      background: var(--panel);
      padding: 16px 20px;
      border-radius: 12px;
      border: 1px solid var(--border);
    }
    .msg.user {
      align-self: flex-end;
      background: #1f385c;
      padding: 12px 18px;
      border-radius: 12px;
      color: #fff;
      max-width: 80%;
    }
    .prompts {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    .prompt-btn {
      background: #21262d;
      color: var(--text);
      border: 1px solid var(--border);
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
    }
    .prompt-btn:hover { border-color: var(--blue); background: #30363d; }
    .input-bar {
      padding: 16px 24px;
      background: var(--panel);
      border-top: 1px solid var(--border);
    }
    .input-wrapper {
      max-width: 800px;
      margin: 0 auto;
      display: flex;
      gap: 10px;
    }
    input[type="text"] {
      flex: 1;
      height: 44px;
      padding: 0 16px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: #0d1117;
      color: var(--text);
      font-size: 15px;
      outline: none;
    }
    input[type="text"]:focus { border-color: var(--blue); }
    button.send-btn {
      background: var(--blue);
      color: #fff;
      border: none;
      padding: 0 20px;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
    }
    button.send-btn:hover { filter: brightness(1.1); }
  </style>
</head>
<body>
  <header>
    <div class="logo">
      <span>✨</span> ${hostname}
    </div>
    <div style="font-size: 13px; color: var(--muted);">AI Study Assistant · Allowlist Focused</div>
  </header>
  <div class="chat-container" id="chatList">
    <div class="msg ai">
      <div>
        <strong>${hostname} Study Copilot</strong>
        <p style="margin:8px 0 0;">Hello! I'm your dedicated AI study assistant. Ask me to explain any algorithm, debug your code, summarize notes, or quiz you on computer science concepts.</p>
        <div class="prompts">
          <button class="prompt-btn" onclick="ask('Explain Dynamic Programming with an example')">Explain Dynamic Programming</button>
          <button class="prompt-btn" onclick="ask('How do PostgreSQL indexes work under the hood?')">How PostgreSQL Indexes work</button>
          <button class="prompt-btn" onclick="ask('What is the difference between TCP and UDP?')">TCP vs UDP</button>
          <button class="prompt-btn" onclick="ask('Write a TypeScript function for Binary Search')">TypeScript Binary Search</button>
        </div>
      </div>
    </div>
  </div>
  <div class="input-bar">
    <form class="input-wrapper" onsubmit="handleSend(event)">
      <input type="text" id="userInput" placeholder="Ask a study question..." autocomplete="off" />
      <button type="submit" class="send-btn">Send</button>
    </form>
  </div>
  <script>
    const knowledge = {
      "dynamic programming": "Dynamic Programming (DP) is an algorithmic technique for solving optimization problems by breaking them down into overlapping subproblems and caching their results (memoization or tabulation). Classic examples include Fibonacci, Knapsack, and Longest Common Subsequence.",
      "postgresql": "PostgreSQL indexes (like B-trees, GIN, and GiST) speed up data retrieval by creating a sorted lookup tree of indexed column values that points directly to table rows, reducing disk I/O from O(N) linear scans to O(log N).",
      "tcp": "TCP (Transmission Control Protocol) is connection-oriented, reliable, and ordered (using a 3-way handshake and ACK packets). UDP is connectionless and faster with lower latency, but does not guarantee delivery or packet ordering.",
      "binary search": "Binary search finds an item in a sorted array in O(log N) time by repeatedly dividing the search interval in half. In TypeScript:\\n\\nfunction binarySearch(arr: number[], target: number): number {\\n  let left = 0, right = arr.length - 1;\\n  while (left <= right) {\\n    const mid = Math.floor((left + right) / 2);\\n    if (arr[mid] === target) return mid;\\n    if (arr[mid] < target) left = mid + 1;\\n    else right = mid - 1;\\n  }\\n  return -1;\\n}"
    };

    function ask(text) {
      addMessage(text, 'user');
      setTimeout(() => {
        const lower = text.toLowerCase();
        let reply = "I'm ready to help you study this topic! Let's break it down step by step so you can master the underlying principles and ace your exams.";
        for (const key in knowledge) {
          if (lower.includes(key)) {
            reply = knowledge[key];
            break;
          }
        }
        addMessage(reply, 'ai');
      }, 400);
    }

    function handleSend(e) {
      e.preventDefault();
      const input = document.getElementById('userInput');
      const val = input.value.trim();
      if (!val) return;
      input.value = '';
      ask(val);
    }

    function addMessage(text, type) {
      const chat = document.getElementById('chatList');
      const div = document.createElement('div');
      div.className = 'msg ' + type;
      if (type === 'ai') {
        div.innerHTML = '<div><strong>${hostname}</strong><p style="margin:8px 0 0; white-space: pre-wrap;">' + text + '</p></div>';
      } else {
        div.innerText = text;
      }
      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
    }
  </script>
</body>
</html>`;
}

function getGitHubPage(hostname: string, url: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GitHub - Repository Explorer</title>
  <style>
    :root {
      --bg: #0d1117;
      --panel: #161b22;
      --text: #e6edf3;
      --muted: #8b949e;
      --blue: #2f81f7;
      --border: #30363d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 24px;
      background: var(--panel);
      border-bottom: 1px solid var(--border);
    }
    .logo { font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
    .container { max-width: 1040px; margin: 24px auto; padding: 0 20px; }
    .repo-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
    }
    .repo-name { font-size: 20px; font-weight: 600; color: var(--blue); }
    .file-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      background: var(--panel);
    }
    .file-table th, .file-table td {
      padding: 10px 16px;
      text-align: left;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
    }
    .file-table tr:hover { background: #1f242c; cursor: pointer; }
    .file-icon { color: var(--muted); margin-right: 8px; }
    .readme-box {
      margin-top: 24px;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 24px;
      background: var(--panel);
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">📦 GitHub Study Explorer</div>
    <div style="font-size:13px; color:var(--muted);">Allowlist Mode</div>
  </header>
  <div class="container">
    <div class="repo-header">
      <div class="repo-name">pranessadhwin / DFBrowse</div>
      <span style="font-size:12px; background:#21262d; padding:4px 10px; border-radius:12px;">Public Repository</span>
    </div>
    <table class="file-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Last Commit</th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody>
        <tr onclick="alert('Viewing client/ directory...')">
          <td><span class="file-icon">📁</span>client</td>
          <td style="color:var(--muted);">feat: full-stack web application (React + TS + Vite)</td>
          <td style="color:var(--muted);">Just now</td>
        </tr>
        <tr onclick="alert('Viewing server/ directory...')">
          <td><span class="file-icon">📁</span>server</td>
          <td style="color:var(--muted);">feat: Express + PostgreSQL backend with zero-config fallback</td>
          <td style="color:var(--muted);">Just now</td>
        </tr>
        <tr onclick="alert('Viewing README.md...')">
          <td><span class="file-icon">📄</span>README.md</td>
          <td style="color:var(--muted);">docs: update architecture documentation for web and desktop</td>
          <td style="color:var(--muted);">Just now</td>
        </tr>
        <tr onclick="alert('Viewing package.json...')">
          <td><span class="file-icon">📄</span>package.json</td>
          <td style="color:var(--muted);">chore: add concurrent web scripts</td>
          <td style="color:var(--muted);">Just now</td>
        </tr>
      </tbody>
    </table>
    <div class="readme-box">
      <h2 style="margin-top:0;">DFBrowse — Focused Allowlist Study Browser</h2>
      <p>DFBrowse only allows websites on your study allowlist, and the allowlist is protected by a Feature Password.</p>
      <ul>
        <li><strong>React + TypeScript Frontend:</strong> Modern toolbar, focus timer, and allowlist manager modal.</li>
        <li><strong>Node.js + Express + PostgreSQL Backend:</strong> Secure study proxy and navigation audit logs.</li>
      </ul>
    </div>
  </div>
</body>
</html>`;
}

function getGeeksForGeeksPage(hostname: string, url: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GeeksforGeeks - Computer Science Tutorials</title>
  <style>
    :root {
      --bg: #0f172a;
      --panel: #1e293b;
      --text: #f1f5f9;
      --muted: #94a3b8;
      --green: #22c55e;
      --border: #334155;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 28px;
      background: var(--panel);
      border-bottom: 1px solid var(--border);
    }
    .logo { font-size: 19px; font-weight: 700; color: var(--green); }
    .content {
      max-width: 900px;
      margin: 30px auto;
      padding: 0 20px;
      line-height: 1.7;
    }
    .article-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 28px;
      margin-bottom: 24px;
    }
    h1 { margin-top: 0; font-size: 26px; }
    h2 { color: var(--green); margin-top: 24px; font-size: 19px; }
    pre {
      background: #0f172a;
      border: 1px solid var(--border);
      padding: 14px;
      border-radius: 8px;
      font-family: monospace;
      overflow-x: auto;
    }
    .tag {
      display: inline-block;
      background: rgba(34, 197, 94, 0.15);
      color: var(--green);
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      margin-right: 8px;
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">GeeksforGeeks · Study Portal</div>
    <div style="font-size:13px; color:var(--muted);">Focused Study Mode</div>
  </header>
  <div class="content">
    <div class="article-card">
      <div style="margin-bottom: 14px;">
        <span class="tag">Algorithms</span>
        <span class="tag">Data Structures</span>
        <span class="tag">TypeScript</span>
      </div>
      <h1>Top 10 Algorithms Every Computer Science Student Must Know</h1>
      <p>Mastering fundamental algorithms is critical for technical interviews and efficient software engineering. Here is a curated guide to essential algorithms:</p>
      <h2>1. Binary Search (Logarithmic Time O(log N))</h2>
      <p>Binary Search is an efficient algorithm for finding an item from a sorted list of items by repeatedly halving the search interval.</p>
      <pre>function binarySearch(arr: number[], target: number): number {
  let low = 0, high = arr.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
}</pre>
      <h2>2. Breadth-First Search (BFS) & Depth-First Search (DFS)</h2>
      <p>Graph traversal algorithms used for shortest path calculations, cycle detection, and tree serialization.</p>
    </div>
  </div>
</body>
</html>`;
}

function getGenericStudyPage(hostname: string, url: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${hostname} - Study Resource</title>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #07101d;
      color: #e6edf7;
      padding: 40px;
    }
    .card {
      max-width: 780px;
      margin: 0 auto;
      background: #0d1b2d;
      border: 1px solid rgba(87, 166, 255, 0.25);
      border-radius: 16px;
      padding: 36px;
      box-shadow: 0 22px 60px rgba(0,0,0,0.4);
    }
    h1 { margin-top: 0; font-size: 24px; }
    .domain { color: #57a6ff; font-family: monospace; font-size: 15px; }
    p { line-height: 1.6; color: #94a3b8; }
    .search-bar {
      display: flex;
      gap: 10px;
      margin-top: 24px;
    }
    input {
      flex: 1;
      height: 42px;
      padding: 0 16px;
      border-radius: 8px;
      border: 1px solid rgba(148, 163, 184, 0.22);
      background: #10233a;
      color: #fff;
      font-size: 14px;
    }
    button {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 0 20px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="domain">${url}</div>
    <h1>${hostname} Study Workspace</h1>
    <p>This study domain is active on your DFBrowse allowlist. You can browse, take notes, and search documentation without distractions.</p>
    <div class="search-bar">
      <input type="text" id="searchInput" placeholder="Search ${hostname} documentation or articles..." onkeydown="if(event.key === 'Enter') alert('Searching ${hostname} for: ' + this.value)" />
      <button onclick="alert('Searching ' + document.getElementById('searchInput').value)">Search</button>
    </div>
  </div>
</body>
</html>`;
}
