(async function () {
    const user = await guardAuth();
    if (!user) return;

    const content = renderShell(user, "/dashboard.html");
    setPageTitle("Dashboard");
    content.innerHTML = `
        <div class="skeleton" style="height:170px;margin-bottom:22px"></div>
        ${skeletonGrid(3)}
    `;

    try {
        const data = await api("/dashboard");

        const banners = data.branding.banners || [];
        const hasImage = banners.length > 0;
        const bannerImages = hasImage
            ? banners.map((b, i) => `<img src="${b}" class="bg-slide ${i === 0 ? "active" : ""}">`).join("")
            : "";

        const dashboardNavItems = NAV_ITEMS.filter((item) => item.href !== "/dashboard.html" && (!item.roles || item.roles.includes(user.role)));
        const navBoxesHtml = dashboardNavItems.map((item, index) => `
            <a class="nav-box ${index >= 4 ? "nav-box-extra" : ""}" href="${item.href}">
                <span class="icon">${icon(item.icon)}</span>
                <span>
                    <div class="label">${item.label}</div>
                    <div class="sub">${item.sub}</div>
                </span>
                <span class="chevron">${icon("chevron")}</span>
            </a>
        `).join("");
        const navToggleHtml = dashboardNavItems.length > 4 ? `<button class="dashboard-nav-toggle" id="dashboard-nav-toggle" type="button" aria-expanded="false">Show more</button>` : "";

        const s = data.systemStatus;
        const stats = data.stats || {};
        const statusItem = (name, ok) => `
            <div class="status-item">
                <div class="status-row">
                    <span class="status-dot ${ok ? "online" : "offline"}"></span>
                    <span class="status-name">${name}</span>
                </div>
                <div class="status-text">${ok ? "Operational" : "Down"}</div>
            </div>
        `;

        content.innerHTML = `
            <div class="account-banner glass ${hasImage ? "has-image" : ""}" id="account-banner">
                ${bannerImages}
                ${hasImage ? `<div class="scrim"></div>` : ""}
                <div class="banner-content">
                    <div class="banner-brand">${data.branding.webName || "SHOYU PANEL"}</div>
                    <div class="banner-subtitle">${data.branding.webSubtitle || "WhatsApp Management Panel"}</div>
                    <div class="username text-gradient">${data.account.username}</div>
                    <div class="account-grid">
                        <div class="stat"><div class="label">Role</div><div class="val">${data.account.role}</div></div>
                        <div class="stat"><div class="label">Status</div><div class="val">${data.account.status}</div></div>
                        <div class="stat"><div class="label">Expires</div><div class="val">${data.account.expiredAt ? new Date(data.account.expiredAt).toLocaleDateString("en-US") : "Lifetime"}</div></div>
                        <div class="stat"><div class="label">Senders</div><div class="val">${data.senderCount}</div></div>
                    </div>
                </div>
            </div>

            <div class="nav-box-grid bottom-navigation">
                ${navBoxesHtml}
                ${navToggleHtml}
            </div>

            <div class="dashboard-metrics" aria-label="Account metrics">
                <div class="metric-item"><span class="metric-dot online"></span><div><span class="metric-label">Active Sessions</span><strong>${stats.activeSenderCount ?? 0}</strong><small>of ${data.senderCount} registered</small></div></div>
                <div class="metric-item"><span class="metric-dot blue"></span><div><span class="metric-label">Messages Sent</span><strong>${stats.totalMessages ?? 0}</strong><small>successful activity</small></div></div>
                <div class="metric-item"><span class="metric-dot warning"></span><div><span class="metric-label">Logged Issues</span><strong>${stats.errorCount ?? 0}</strong><small>recent account activity</small></div></div>
            </div>

            <div class="card" style="margin-bottom:14px">
                <h3>System Status</h3>
                <div class="status-strip">
                    ${statusItem("Website", s.web)}
                    ${statusItem("API", s.api)}
                    ${statusItem("Telegram", s.telegram)}
                    ${statusItem("WhatsApp", s.whatsapp)}
                </div>
            </div>

            <div class="card">
                <h3>Recent Activity</h3>
                ${data.recentActivity.length ? `
                    <div class="activity-log" role="log" aria-label="Recent activity">
                        ${data.recentActivity.map((l, index) => {
                            const level = l.type === "error" || l.success === false ? "error" : l.type === "auth" ? "auth" : "event";
                            const detail = l.message || l.target || l.number || l.username || "Event processed";
                            return `
                                <div class="activity-entry ${level} ${index === 0 ? "latest" : ""}">
                                    <span class="activity-marker" aria-hidden="true"></span>
                                    <time class="activity-time">${new Date(l.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</time>
                                    <span class="activity-level">${level}</span>
                                    <span class="activity-type">${l.type || "system"}</span>
                                    <span class="activity-action">${l.action || "activity"}</span>
                                    <span class="activity-detail">${detail}</span>
                                </div>
                            `;
                        }).join("")}
                    </div>
                ` : emptyState("No activity yet.", "logs")}
            </div>
        `;

        if (banners.length > 1) {
            let idx = 0;
            setInterval(() => {
                const imgs = document.querySelectorAll("#account-banner .bg-slide");
                imgs[idx].classList.remove("active");
                idx = (idx + 1) % imgs.length;
                imgs[idx].classList.add("active");
            }, 4000);
        }

        const navToggle = document.getElementById("dashboard-nav-toggle");
        if (navToggle) navToggle.addEventListener("click", () => {
            const expanded = navToggle.getAttribute("aria-expanded") === "true";
            navToggle.setAttribute("aria-expanded", String(!expanded));
            navToggle.textContent = expanded ? "Show more" : "Show less";
            document.querySelectorAll(".nav-box-extra").forEach((item) => item.classList.toggle("is-visible", !expanded));
        });
    } catch (err) {
        content.innerHTML = errorState(err.message);
        toast(err.message, "error");
    }
})();