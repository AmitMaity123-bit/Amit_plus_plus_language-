/* script.js — UI glue for Amit++ Playground */
(() => {
  const editor = document.getElementById('editor');
  const outputEl = document.getElementById('output');
  const runBtn = document.getElementById('runBtn');
  const examplesSelect = document.getElementById('examplesSelect');
  const fileInput = document.getElementById('fileInput');
  const downloadBtn = document.getElementById('downloadBtn');
  const clearBtn = document.getElementById('clearBtn');
  const status = document.getElementById('status');

  // examples will be populated by script; we'll request them from a global examples object in interpreter.js
  function populateExamples() {
    if (window.AMIT_EXAMPLES) {
      for (const name of Object.keys(window.AMIT_EXAMPLES)) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        examplesSelect.appendChild(opt);
      }
    }
  }

  populateExamples();

  editor.value = localStorage.getItem('amitpp_last_code') || (window.AMIT_EXAMPLES ? window.AMIT_EXAMPLES['01_basic_math.aim'] : '');

  editor.addEventListener('input', () => {
    localStorage.setItem('amitpp_last_code', editor.value);
    status.textContent = 'Saved locally';
    setTimeout(()=> status.textContent = '', 1200);
  });

  downloadBtn.addEventListener('click', () => {
    const blob = new Blob([editor.value], {type:'text/plain;charset=utf-8'});
    const name = prompt('Save as filename:', 'my_program.aim') || 'my_program.aim';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  examplesSelect.addEventListener('change', () => {
    const k = examplesSelect.value;
    if (!k) return;
    editor.value = window.AMIT_EXAMPLES[k] || '';
  });

  fileInput.addEventListener('change', (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => editor.value = reader.result;
    reader.readAsText(f, 'utf-8');
  });

  clearBtn.addEventListener('click', () => {
    if (confirm('Editor খালি করতেই চাও?')) { editor.value=''; localStorage.removeItem('amitpp_last_code'); }
  });

  runBtn.addEventListener('click', () => {
    outputEl.textContent = '';
    const codeText = editor.value;
    try {
      const result = window.AmitppInterpreter.run(codeText);
      if (result.error) {
        outputEl.textContent += `Error: ${result.error.message} (line ${result.error.line}: ${result.error.text})\n`;
      }
      if (result.output.length) outputEl.textContent += result.output.join('\n') + '\n';
      status.textContent = 'Ran successfully';
    } catch (e) {
      outputEl.textContent = 'Fatal: ' + e.message + '\n';
      status.textContent = 'Execution failed';
    }
  });

  // expose run for convenience
  window.amitppRun = () => runBtn.click();

})();