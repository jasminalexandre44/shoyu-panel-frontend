(async function () {
    const user = await guardAuth();
    if (!user) return;

    const content = renderShell(user, "/whatsapp.html");
    setPageTitle("WhatsApp Management");
    const canCreateGlobalSender = user.role === "OWNER" || user.role === "ADMIN";

    function sessionRow(s) {
        const st = s.live || s.status;
        return `
            <tr>
                <td>${s.number}</td>
                <td><span class="pill ${pillClass(st)}">${st}</span></td>
                <td>${s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-US") : "-"}</td>
                <td><button class="btn danger" data-remove="${s.number}">Remove</button></td>
            </tr>
        `;
    }

    async function loadSessions() {
        const listBox = document.getElementById("session-list");
        listBox.innerHTML = `<div class="skeleton" style="height:80px"></div>`;
        try {
            const data = await api("/whatsapp/sessions");
            const rows = data.personal || [];
            listBox.innerHTML = rows.length
                ? `<table><thead><tr><th>Number</th><th>Status</th><th>Created</th><th></th></tr></thead>
                   <tbody>${rows.map(sessionRow).join("")}</tbody></table>`
                : emptyState("No senders yet.", "whatsapp");

            listBox.querySelectorAll("[data-remove]").forEach((btn) => {
                btn.addEventListener("click", async () => {
                    btn.disabled = true;
                    try {
                        await api("/whatsapp/remove", { method: "POST", body: { number: btn.dataset.remove } });
                        toast("Session removed.", "success");
                        loadSessions();
                    } catch (err) {
                        toast(err.message, "error");
                        btn.disabled = false;
                    }
                });
            });
        } catch (err) {
            listBox.innerHTML = errorState(err.message);
        }
    }

    async function startPairing() {
        const numberInput = document.getElementById("pair-number");
        const number = numberInput.value.trim().replace(/[^0-9]/g, "");
        const resultBox = document.getElementById("pair-result");
        const btn = document.getElementById("pair-btn");
        const visibility = document.querySelector("input[name=sender-visibility]:checked")?.value || "personal";

        if (!number) { toast("Phone number is required.", "error"); return; }

        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> Requesting code...`;
        resultBox.innerHTML = "";
        setPairStep(2);

        try {
            const res = await api("/whatsapp/pair", { method: "POST", body: { number, isGlobal: visibility === "global" && canCreateGlobalSender } });
            setPairStep(3);
            resultBox.innerHTML = res.pairingCode
                ? `<div class="pairing-code-result"><div class="pill pairing"><span>Pairing code</span><strong id="pairing-code-value">${res.pairingCode}</strong></div><button type="button" class="btn secondary copy-pairing-btn" id="copy-pairing-code" aria-label="Copy pairing code">${icon("copy")}<span>Copy</span></button></div>
                         <div class="sub" style="margin-top:8px">Enter this code in WhatsApp: Linked devices &rarr; Link with phone number.</div>`
                     : `<div class="sub">Session found. Waiting for confirmation...</div>`;

            btn.textContent = "Waiting for connection...";
            const copyButton = document.getElementById("copy-pairing-code");
            if (copyButton) copyButton.addEventListener("click", async () => {
                const code = document.getElementById("pairing-code-value")?.textContent || "";
                try {
                    await navigator.clipboard.writeText(code);
                } catch {
                    const helper = document.createElement("textarea");
                    helper.value = code;
                    helper.style.position = "fixed";
                    helper.style.opacity = "0";
                    document.body.appendChild(helper);
                    helper.select();
                    document.execCommand("copy");
                    helper.remove();
                }
                copyButton.classList.add("copied");
                copyButton.querySelector("span").textContent = "Copied";
                toast("Pairing code copied.", "success");
                setTimeout(() => {
                    copyButton.classList.remove("copied");
                    copyButton.querySelector("span").textContent = "Copy";
                }, 1600);
            });
            await api("/whatsapp/confirm", { method: "POST", body: { number } });

            toast("WhatsApp connected successfully.", "success");
            setPairStep(4);
            numberInput.value = "";
            resultBox.innerHTML = `<div class="pill connected">Connected</div>`;
            loadSessions();
        } catch (err) {
            setPairStep(1);
            toast(err.message, "error");
            resultBox.innerHTML = `<div class="sub" style="color:var(--danger)">${err.message}</div>`;
        } finally {
            btn.disabled = false;
            btn.textContent = "Start pairing";
        }
    }

    function setPairStep(activeStep) {
        document.querySelectorAll("[data-pair-step]").forEach((step) => {
            const stepNumber = Number(step.dataset.pairStep);
            step.classList.toggle("active", stepNumber === activeStep);
            step.classList.toggle("complete", stepNumber < activeStep);
        });
    }

    content.innerHTML = `
        <div class="page-intro"><div><span class="page-kicker">Sender operations</span><h2>WhatsApp Management</h2><p>Pair, monitor, and remove WhatsApp sender sessions.</p></div><a class="btn secondary" href="/xmessage.html">Open Travas</a></div>
        <div class="card" style="max-width:460px">
            <h3>Pair a new number</h3>
            <div class="pair-steps" aria-label="Pairing progress">
                <div class="pair-step active" data-pair-step="1"><span>1</span><small>Number</small></div>
                <i></i>
                <div class="pair-step" data-pair-step="2"><span>2</span><small>Request</small></div>
                <i></i>
                <div class="pair-step" data-pair-step="3"><span>3</span><small>Confirm</small></div>
                <i></i>
                <div class="pair-step" data-pair-step="4"><span>4</span><small>Connected</small></div>
            </div>
            <div class="field">
                <label>WhatsApp number (international format)</label>
                <input type="text" id="pair-number" placeholder="Ex : 628123678910">
            </div>
            ${canCreateGlobalSender ? `<div class="sender-visibility field"><label>Sender visibility</label><div class="visibility-options"><label class="visibility-option"><input type="radio" name="sender-visibility" value="personal" checked><span><strong>Personal</strong><small>Only you can use this sender.</small></span></label><label class="visibility-option"><input type="radio" name="sender-visibility" value="global"><span><strong>Global</strong><small>Available to permitted users.</small></span></label></div></div>` : `<div class="pairing-visibility-note"><strong>Personal sender</strong><span>This sender is private to your account.</span></div>`}
            <button class="btn block" id="pair-btn">Start pairing</button>
            <div id="pair-result" style="margin-top:12px"></div>
            <div class="sub" style="margin-top:8px">
                <strong>Note:</strong> Pairing a number will create a new sender session. You can only pair numbers that you own and have access to. The pairing code will be sent to your WhatsApp app for confirmation.
            </div>
        </div>

        <div class="card" style="margin-top:16px">
            <h3>Your senders</h3>
            <div id="session-list"><div class="skeleton" style="height:80px"></div></div>
        </div>
    `;

    document.getElementById("pair-btn").addEventListener("click", startPairing);
    loadSessions();
})();