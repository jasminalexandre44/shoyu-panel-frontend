(async function () {
    const user = await guardAuth();
    if (!user) return;

    const content = renderShell(user, "/database.html");
    setPageTitle("Database");

    if (user.role !== "OWNER") {
        content.innerHTML = errorState("Only the owner can access the user database.");
        return;
    }

    let users = [];
    let roles = [];
    let canCreateOwners = false;
    let temporaryPassword = "";

    const escapeHtml = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const formatDate = (value) => value ? new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "Lifetime";
    const isExpired = (user) => user.expiredAt && new Date(user.expiredAt) < new Date();

    function userStatus(user) {
        if (isExpired(user)) return ["Expired", "danger"];
        if (user.status !== "active") return [user.status, "muted"];
        return ["Active", "success"];
    }

    function render() {
        const query = document.getElementById("database-search")?.value.trim().toLowerCase() || "";
        const roleFilter = document.getElementById("database-role")?.value || "";
        const selectableRoles = canCreateOwners ? roles : roles.filter((role) => role !== "OWNER");
        const filtered = users.filter((entry) => {
            const matchesQuery = !query || [entry.username, entry.telegramId, entry.role].some((value) => String(value || "").toLowerCase().includes(query));
            return matchesQuery && (!roleFilter || entry.role === roleFilter);
        });
        const activeCount = users.filter((entry) => userStatus(entry)[0] === "Active").length;
        const expiringCount = users.filter((entry) => entry.expiredAt && !isExpired(entry)).length;

        content.innerHTML = `
            <div class="page-intro database-intro">
                <div><span class="page-kicker">Owner control center</span><h2>User Database</h2><p>Create, review, and remove panel accounts from one protected workspace.</p></div>
                <button class="btn" id="open-create-user">${icon("plus")} Create user</button>
            </div>
            <div class="database-stats grid grid-3">
                <div class="card database-stat"><span>Total accounts</span><strong>${users.length}</strong><small>All records in storage</small></div>
                <div class="card database-stat"><span>Active accounts</span><strong>${activeCount}</strong><small>Ready to access the panel</small></div>
                <div class="card database-stat"><span>Time-limited</span><strong>${expiringCount}</strong><small>Accounts with an expiry date</small></div>
            </div>
            <div class="card database-card">
                <div class="database-toolbar">
                    <div><h3>Accounts</h3><p>Passwords are never displayed after creation.</p></div>
                    <div class="database-filters"><input id="database-search" type="search" placeholder="Search username, role, Telegram ID"><select id="database-role"><option value="">All roles</option>${roles.map((role) => `<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`).join("")}</select></div>
                </div>
                <div id="database-table">${renderTable(filtered)}</div>
            </div>
            <div class="database-modal" id="create-user-modal" hidden>
                <div class="database-modal-backdrop" data-close-create></div>
                <form class="card database-form" id="create-user-form">
                    <div class="modal-header"><div><span class="page-kicker">New account</span><h3>Create user</h3></div><button type="button" class="icon-button" data-close-create aria-label="Close">&times;</button></div>
                    <div class="database-form-grid">
                        <label class="field"><span>Username</span><input name="username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" placeholder="new_user"></label>
                        <label class="field"><span>Role</span><select name="role">${selectableRoles.map((role) => `<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`).join("")}</select></label>
                        ${canCreateOwners ? `<label class="field"><span>Owner key <small>(only for OWNER)</small></span><input name="ownerKey" type="password" placeholder="Required only when creating OWNER"></label>` : ""}
                        <label class="field"><span>Password <small>(optional)</small></span><input name="password" minlength="8" maxlength="72" type="password" placeholder="Generate automatically"></label>
                        <label class="field"><span>Telegram ID <small>(optional)</small></span><input name="telegramId" inputmode="numeric" placeholder="123456789"></label>
                        <label class="field"><span>Duration</span><input name="duration" type="text" placeholder="Lifetime, 30d, 2w, 6m, 1y, 72h" list="duration-presets"><datalist id="duration-presets"><option value=""></option><option value="1d">1 day</option><option value="7d">7 days</option><option value="30d">30 days</option><option value="90d">90 days</option><option value="6m">6 months</option><option value="1y">1 year</option><option value="Lifetime"></option></datalist></label>
                    </div>
                    <div id="create-user-error" class="auth-error"></div>
                    <div class="modal-actions"><button type="button" class="btn secondary" data-close-create>Cancel</button><button class="btn" type="submit">Create account</button></div>
                </form>
            </div>
            <div class="database-modal" id="password-modal" hidden><div class="database-modal-backdrop" data-close-password></div><div class="card database-password"><span class="page-kicker">Save these credentials</span><h3>Account created</h3><p>The generated password is shown once. Store it securely before closing.</p><div class="credential-line"><span>Username</span><strong id="created-username"></strong></div><div class="credential-line"><span>Password</span><strong id="created-password"></strong></div><button class="btn block" data-close-password>Done</button></div></div>
        `;

        document.getElementById("database-search").addEventListener("input", render);
        document.getElementById("database-role").addEventListener("change", render);
        document.getElementById("open-create-user").addEventListener("click", () => { document.getElementById("create-user-modal").hidden = false; });
        document.querySelectorAll("[data-close-create]").forEach((element) => element.addEventListener("click", () => { document.getElementById("create-user-modal").hidden = true; }));
        document.querySelectorAll("[data-close-password]").forEach((element) => element.addEventListener("click", () => { document.getElementById("password-modal").hidden = true; }));
        document.getElementById("create-user-form").addEventListener("submit", createUser);
        document.querySelectorAll("[data-delete-user]").forEach((button) => button.addEventListener("click", () => deleteUser(button.dataset.deleteUser, button.dataset.username)));
    }

    function renderTable(filtered) {
        if (!filtered.length) return `<div class="empty-state"><strong>No matching accounts</strong><span>Try another search or create a new user.</span></div>`;
        return `<div class="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Telegram ID</th><th>Expires</th><th>Created</th><th></th></tr></thead><tbody>${filtered.map((entry) => {
            const [status, statusClass] = userStatus(entry);
            const protectedUser = entry.role === "OWNER";
            return `<tr><td><strong>${escapeHtml(entry.username)}</strong><small class="table-sub">${escapeHtml(entry.source)} account</small></td><td><span class="role-badge">${escapeHtml(entry.role)}</span></td><td><span class="status-pill ${statusClass}">${escapeHtml(status)}</span></td><td>${escapeHtml(entry.telegramId || "-")}</td><td>${formatDate(entry.expiredAt)}</td><td>${formatDate(entry.createdAt)}</td><td>${protectedUser ? `<span class="table-protected">Protected</span>` : `<button class="btn danger small" data-delete-user="${escapeHtml(entry.id)}" data-username="${escapeHtml(entry.username)}">Delete</button>`}</td></tr>`;
        }).join("")}</tbody></table></div>`;
    }

    async function loadUsers() {
        try {
            const data = await api("/database/users");
            users = data.users || [];
            roles = data.roles || ["OWNER", "ADMIN", "RESELLER", "VVIP", "PREMIUM"];
            canCreateOwners = Boolean(data.canCreateOwners);
            render();
        } catch (error) {
            content.innerHTML = errorState(error.message);
        }
    }

    async function createUser(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const errorBox = document.getElementById("create-user-error");
        const button = form.querySelector("button[type=submit]");
        button.disabled = true;
        errorBox.textContent = "";
        const payload = Object.fromEntries(new FormData(form).entries());
        try {
            const data = await api("/database/users", { method: "POST", body: payload });
            document.getElementById("create-user-modal").hidden = true;
            document.getElementById("created-username").textContent = data.user.username;
            document.getElementById("created-password").textContent = data.temporaryPassword || "Custom password saved";
            document.getElementById("password-modal").hidden = false;
            await loadUsers();
        } catch (error) {
            errorBox.textContent = error.message;
        } finally {
            button.disabled = false;
        }
    }

    async function deleteUser(id, username) {
        if (!window.confirm(`Delete account ${username}? This cannot be undone.`)) return;
        try {
            await api(`/database/users/${encodeURIComponent(id)}`, { method: "DELETE" });
            toast("Account deleted.", "success");
            await loadUsers();
        } catch (error) {
            toast(error.message, "error");
        }
    }

    await loadUsers();
})();
