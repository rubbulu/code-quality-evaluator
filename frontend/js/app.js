const editor = CodeMirror.fromTextArea(document.getElementById("codeEditor"), {
  lineNumbers: true,
  mode: "javascript",
  theme: "default"
});

document.getElementById("languageSelect").addEventListener("change", function() {
  editor.setOption("mode", this.value);
});

document.getElementById("analyzeBtn").addEventListener("click", async () => {
  const code = editor.getValue();
  const language = document.getElementById("languageSelect").value;

  try {
    const response = await fetch("http://localhost:5000/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, code })
    });
    const result = await response.json();
    document.getElementById("output").innerText = JSON.stringify(result, null, 2);
  } catch (err) {
    document.getElementById("output").innerText = "Error: backend not reachable";
  }
});