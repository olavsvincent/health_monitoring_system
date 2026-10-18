
document.addEventListener("DOMContentLoaded", () => {
    // ==========================
    // ELEMENTS
    // ==========================

    const $ = (id) => document.getElementById(id);

    const heartRateDisplay = $("heartRate");
    const spo2Display = $("spo2");
    const heartStatus = $("heartStatus");
    const spo2Status = $("spo2Status");
    const historyTable = $("historyTable");
    const alertList = $("alertList");
    const lastUpdated = $("lastUpdated");

    // ==========================
    // APPLICATION DATA
    // ==========================

    let readings = [];
    let alerts = [];
    let paused = false;
    let timer = null;
    let lastAlertKey = "";

    let settings = {
        heartMin: 60,
        heartMax: 100,
        spo2Min: 95
    };

    const MAX_HISTORY = 50;
    const MAX_ALERTS = 20;

    // ==========================
    // DATE AND TIME
    // ==========================

    function updateDate() {
        $("currentDate").textContent =
            new Date().toLocaleDateString(undefined, {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric"
            });
    }

    function formatTime(date) {
        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
    }

    // ==========================
    // SIMULATED SENSOR READINGS
    // Replace with actual ESP32
    // data when integrating hardware.
    // ==========================

    function generateReading() {
        return {
            heartRate: Math.floor(Math.random() * 31) + 65,
            spo2: Math.floor(Math.random() * 5) + 95,
            time: new Date()
        };
    }

    // ==========================
    // HEALTH STATUS
    // These are demo thresholds.
    // ==========================

    function getReadingStatus(reading) {
        const messages = [];

        if (
            reading.heartRate < settings.heartMin ||
            reading.heartRate > settings.heartMax
        ) {
            messages.push("Heart rate outside configured limits");
        }

        if (reading.spo2 < settings.spo2Min) {
            messages.push("SpO₂ below configured limit");
        }

        return messages;
    }

    function updateStatusBadge(element, isWarning, text) {
        element.textContent = text;
        element.className = isWarning
            ? "status-pill warning"
            : "status-pill normal";
    }

    // ==========================
    // PROCESS A READING
    // ==========================

    function processReading(reading) {
        readings.unshift(reading);
        readings = readings.slice(0, MAX_HISTORY);

        heartRateDisplay.textContent = reading.heartRate;
        spo2Display.textContent = reading.spo2;

        const messages = getReadingStatus(reading);

        updateStatusBadge(
            heartStatus,
            reading.heartRate < settings.heartMin ||
            reading.heartRate > settings.heartMax,
            reading.heartRate < settings.heartMin ||
            reading.heartRate > settings.heartMax
                ? "Check reading"
                : "Within demo limits"
        );

        updateStatusBadge(
            spo2Status,
            reading.spo2 < settings.spo2Min,
            reading.spo2 < settings.spo2Min
                ? "Check reading"
                : "Within demo limits"
        );

        $("deviceStatus").textContent = paused
            ? "Paused"
            : "Demo Active";

        $("connectionStatus").textContent = "Demo";
        lastUpdated.textContent = formatTime(reading.time);

        handleAlerts(messages, reading);
        renderHistory();
        renderCharts();
    }

    // ==========================
    // ALERT MANAGEMENT
    // ==========================

    function handleAlerts(messages, reading) {
        const key = messages.slice().sort().join("|");

        if (key && key !== lastAlertKey) {
            messages.forEach((message) => {
                addAlert(
                    message +
                    " (Heart rate: " + reading.heartRate +
                    " BPM, SpO₂: " + reading.spo2 + "%)",
                    "warning"
                );
            });
        }

        lastAlertKey = key;
    }

    function addAlert(message, type = "info") {
        const alert = {
            message,
            type,
            time: new Date()
        };

        alerts.unshift(alert);
        alerts = alerts.slice(0, MAX_ALERTS);

        renderAlerts();
    }

    function renderAlerts() {
        alertList.replaceChildren();

        if (alerts.length === 0) {
            const empty = document.createElement("p");
            empty.className = "empty-state";
            empty.textContent = "No alerts yet.";
            alertList.appendChild(empty);
            return;
        }

        alerts.forEach((item) => {
            const element = document.createElement("div");
            element.className = "alert-item " + item.type;

            const time = document.createElement("strong");
            time.textContent = formatTime(item.time) + " — ";

            const message = document.createElement("span");
            message.textContent = item.message;

            element.append(time, message);
            alertList.appendChild(element);
        });
    }

    $("clearAlerts").addEventListener("click", () => {
        alerts = [];
        renderAlerts();
    });

    // ==========================
    // HEALTH HISTORY TABLE
    // ==========================

    function renderHistory() {
        historyTable.replaceChildren();

        if (readings.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 4;
            cell.className = "empty-state";
            cell.textContent = "Waiting for readings...";

            row.appendChild(cell);
            historyTable.appendChild(row);
            return;
        }

        readings.forEach((reading) => {
            const row = document.createElement("tr");
            const messages = getReadingStatus(reading);

            const values = [
                reading.time.toLocaleString(),
                reading.heartRate + " BPM",
                reading.spo2 + "%"
            ];

            values.forEach((value) => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            const statusCell = document.createElement("td");
            statusCell.textContent = messages.length
                ? "Review reading"
                : "Within demo limits";

            statusCell.className = messages.length
                ? "reading-warning"
                : "reading-normal";

            row.appendChild(statusCell);
            historyTable.appendChild(row);
        });
    }

    // ==========================
    // CSV EXPORT
    // ==========================

    $("exportHistory").addEventListener("click", () => {
        if (readings.length === 0) {
            alert("There are no readings to export.");
            return;
        }

        const escapeCSV = (value) =>
            '"' + String(value).replace(/"/g, '""') + '"';

        const rows = [
            ["Date and Time", "Heart Rate (BPM)", "SpO2 (%)", "Status"],
            ...readings.map((reading) => [
                reading.time.toLocaleString(),
                reading.heartRate,
                reading.spo2,
                getReadingStatus(reading).length
                    ? "Review reading"
                    : "Within demo limits"
            ])
        ];

        const csv = rows
            .map((row) => row.map(escapeCSV).join(","))
            .join("\r\n");

        const blob = new Blob(["\uFEFF" + csv], {
            type: "text/csv;charset=utf-8;"
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "health-history.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    });

    // ==========================
    // CHART DRAWING
    // ==========================

    function drawChart(canvasId, key, min, max, lineColor) {
        const canvas = $(canvasId);
        const context = canvas.getContext("2d");

        const width = canvas.clientWidth;

        if (!width) return;

        const height = 190;
        const ratio = window.devicePixelRatio || 1;

        canvas.width = width * ratio;
        canvas.height = height * ratio;

        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, width, height);

        const padding = {
            left: 35,
            right: 12,
            top: 15,
            bottom: 25
        };

        const chartWidth =
            width - padding.left - padding.right;

        const chartHeight =
            height - padding.top - padding.bottom;

        // Grid lines and labels
        context.font = "10px Arial";
        context.textAlign = "right";
        context.textBaseline = "middle";
        context.strokeStyle = "#e8edf5";
        context.fillStyle = "#7b8799";
        context.lineWidth = 1;

        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartHeight / 4) * i;
            const value = max - ((max - min) / 4) * i;

            context.beginPath();
            context.moveTo(padding.left, y);
            context.lineTo(width - padding.right, y);
            context.stroke();

            context.fillText(
                String(Math.round(value)),
                padding.left - 7,
                y
            );
        }

        const ordered = readings.slice(0, 12).reverse();

        if (ordered.length < 2) {
            context.textAlign = "center";
            context.fillStyle = "#7b8799";
            context.fillText(
                "Waiting for more readings...",
                width / 2,
                height / 2
            );
            return;
        }

        context.beginPath();
        context.strokeStyle = lineColor;
        context.lineWidth = 2.5;
        context.lineJoin = "round";
        context.lineCap = "round";

        ordered.forEach((reading, index) => {
            const x =
                padding.left +
                (index / (ordered.length - 1)) * chartWidth;

            const value = reading[key];
            const bounded = Math.max(min, Math.min(max, value));

            const y =
                padding.top +
                ((max - bounded) / (max - min)) * chartHeight;

            if (index === 0) {
                context.moveTo(x, y);
            } else {
                context.lineTo(x, y);
            }
        });

        context.stroke();

        // Plot points
        ordered.forEach((reading, index) => {
            const x =
                padding.left +
                (index / (ordered.length - 1)) * chartWidth;

            const bounded = Math.max(min, Math.min(max, reading[key]));

            const y =
                padding.top +
                ((max - bounded) / (max - min)) * chartHeight;

            context.beginPath();
            context.arc(x, y, 3, 0, Math.PI * 2);
            context.fillStyle = lineColor;
            context.fill();
        });

        context.textAlign = "center";
        context.textBaseline = "alphabetic";
        context.fillStyle = "#7b8799";
        context.fillText("Older", padding.left, height - 5);
        context.fillText(
            "Latest",
            width - padding.right,
            height - 5
        );
    }

    function renderCharts() {
        drawChart("heartChart", "heartRate", 40, 140, "#2563eb");
        drawChart("spo2Chart", "spo2", 80, 100, "#0891b2");
    }

    // ==========================
    // MONITORING CONTROLS
    // ==========================

    function updateReadings() {
        if (paused) return;
        processReading(generateReading());
    }

    function startMonitoring() {
        clearInterval(timer);
        timer = setInterval(updateReadings, 3000);
    }

    $("toggleReadings").addEventListener("click", () => {
        paused = !paused;

        $("toggleReadings").textContent = paused
            ? "Resume Readings"
            : "Pause Readings";

        $("deviceStatus").textContent = paused
            ? "Paused"
            : "Demo Active";

        $("connectionStatus").textContent = paused
            ? "Paused"
            : "Demo";

        if (!paused) {
            updateReadings();
        }
    });

    // ==========================
    // ALERT THRESHOLD SETTINGS
    // ==========================

    $("saveSettings").addEventListener("click", () => {
        const heartMin = Number($("heartMin").value);
        const heartMax = Number($("heartMax").value);
        const spo2Min = Number($("spo2Min").value);
        const message = $("settingsMessage");

        if (
            !Number.isFinite(heartMin) ||
            !Number.isFinite(heartMax) ||
            !Number.isFinite(spo2Min) ||
            heartMin < 30 ||
            heartMax > 220 ||
            heartMin >= heartMax ||
            spo2Min < 50 ||
            spo2Min > 100
        ) {
            message.textContent = "Please enter valid thresholds.";
            message.style.color = "#dc2626";
            return;
        }

        settings = { heartMin, heartMax, spo2Min };

        message.textContent = "Demo settings saved.";
        message.style.color = "#15803d";

        lastAlertKey = "";

        renderHistory();

        if (readings.length > 0) {
            handleAlerts(
                getReadingStatus(readings[0]),
                readings[0]
            );

            updateStatusBadge(
                heartStatus,
                readings[0].heartRate < settings.heartMin ||
                readings[0].heartRate > settings.heartMax,
                readings[0].heartRate < settings.heartMin ||
                readings[0].heartRate > settings.heartMax
                    ? "Check reading"
                    : "Within demo limits"
            );

            updateStatusBadge(
                spo2Status,
                readings[0].spo2 < settings.spo2Min,
                readings[0].spo2 < settings.spo2Min
                    ? "Check reading"
                    : "Within demo limits"
            );
        }
    });

    // ==========================
    // EMERGENCY SOS DEMO
    // ==========================

    $("sosButton").addEventListener("click", () => {
        const confirmed = confirm(
            "Do you want to record an emergency SOS alert?"
        );

        if (!confirmed) return;

        addAlert(
            "SOS REQUESTED. Contact your caregiver or emergency services.",
            "emergency"
        );

        alert(
            "The SOS alert has been recorded in this demo. " +
            "No SMS or emergency call was sent."
        );
    });

    // ==========================
    // PATIENT PROFILE
    // ==========================

    const modal = $("profileModal");

    $("editPatient").addEventListener("click", () => {
        $("nameInput").value = $("patientName").textContent;
        $("idInput").value = $("patientId").textContent;
        $("caregiverInput").value = $("caregiverName").textContent;

        modal.hidden = false;
        $("nameInput").focus();
    });

    $("cancelProfile").addEventListener("click", () => {
        modal.hidden = true;
    });

    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            modal.hidden = true;
        }
    });

    $("profileForm").addEventListener("submit", (event) => {
        event.preventDefault();

        $("patientName").textContent = $("nameInput").value.trim();
        $("patientId").textContent = $("idInput").value.trim();
        $("caregiverName").textContent =
            $("caregiverInput").value.trim();

        modal.hidden = true;
    });

    // ==========================
    // MOBILE NAVIGATION
    // ==========================

    const sidebar = $("sidebar");
    const menuToggle = $("menuToggle");

    function closeMenu() {
        sidebar.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
    }

    menuToggle.addEventListener("click", () => {
        const isOpen = sidebar.classList.toggle("open");
        menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    document.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("click", () => {
            document.querySelectorAll(".nav-link").forEach((item) => {
                item.classList.remove("active");
            });

            link.classList.add("active");
            closeMenu();
        });
    });

    document.addEventListener("click", (event) => {
        if (
            window.innerWidth <= 700 &&
            !sidebar.contains(event.target) &&
            !menuToggle.contains(event.target)
        ) {
            closeMenu();
        }
    });

    window.addEventListener("resize", renderCharts);

    // ==========================
    // INITIALIZE
    // ==========================

    updateDate();
    processReading(generateReading());
    startMonitoring();
});
