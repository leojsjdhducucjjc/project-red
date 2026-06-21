const DISCORD_CLIENT_ID = "1518121387573645312";
const DISCORD_API_BASE = "https://discord.com/api/v10";
const LAUNCH_DATE = new Date("2026-08-21T00:00:00-04:00");

const pendingLinks = document.querySelectorAll('a[href="#"]');
const countdownValues = {
  days: document.querySelector('[data-countdown-value="days"]'),
  hours: document.querySelector('[data-countdown-value="hours"]'),
  minutes: document.querySelector('[data-countdown-value="minutes"]'),
  seconds: document.querySelector('[data-countdown-value="seconds"]'),
};
const discordLogin = document.querySelector("#discord-login");
const discordLogout = document.querySelector("#discord-logout");
const avatarUpload = document.querySelector("#avatar-upload");
const fileName = document.querySelector("#file-name");
const canvas = document.querySelector("#avatar-canvas");
const generateButton = document.querySelector("#generate-avatar");
const downloadButton = document.querySelector("#download-avatar");
const statusText = document.querySelector("#tool-status");
const ctx = canvas.getContext("2d");

let uploadedImage = null;
let lastRenderId = "";

pendingLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    link.classList.add("is-pulsing");
    window.setTimeout(() => link.classList.remove("is-pulsing"), 420);
  });
});

function setStatus(message) {
  statusText.textContent = message;
}

function padTime(value) {
  return String(value).padStart(2, "0");
}

function updateCountdown() {
  if (!countdownValues.days) {
    return;
  }

  const remaining = Math.max(0, LAUNCH_DATE.getTime() - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  countdownValues.days.textContent = String(days).padStart(2, "0");
  countdownValues.hours.textContent = padTime(hours);
  countdownValues.minutes.textContent = padTime(minutes);
  countdownValues.seconds.textContent = padTime(seconds);
}

function getRedirectUri() {
  return `${window.location.origin}${window.location.pathname}`;
}

function createState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getStoredToken() {
  const raw = sessionStorage.getItem("projectRedDiscordAuth");
  if (!raw) {
    return null;
  }

  try {
    const auth = JSON.parse(raw);
    if (Date.now() >= auth.expiresAt) {
      sessionStorage.removeItem("projectRedDiscordAuth");
      return null;
    }

    return auth.accessToken;
  } catch {
    sessionStorage.removeItem("projectRedDiscordAuth");
    return null;
  }
}

function storeToken(accessToken, expiresIn) {
  sessionStorage.setItem(
    "projectRedDiscordAuth",
    JSON.stringify({
      accessToken,
      expiresAt: Date.now() + Number(expiresIn || 3600) * 1000,
    })
  );
}

function parseOAuthRedirect() {
  if (!window.location.hash.includes("access_token")) {
    return false;
  }

  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("access_token");
  const tokenType = params.get("token_type");
  const expiresIn = params.get("expires_in");
  const state = params.get("state");
  const expectedState = sessionStorage.getItem("projectRedOAuthState");

  history.replaceState(null, "", `${window.location.pathname}${window.location.search}#profile-red`);

  if (!accessToken || tokenType?.toLowerCase() !== "bearer" || state !== expectedState) {
    setStatus("Discord sign-in could not be verified. Please try again.");
    return false;
  }

  sessionStorage.removeItem("projectRedOAuthState");
  storeToken(accessToken, expiresIn);
  return true;
}

function startDiscordLogin() {
  if (DISCORD_CLIENT_ID === "PASTE_DISCORD_CLIENT_ID_HERE") {
    setStatus("Add your Discord application client ID in script.js first.");
    return;
  }

  if (window.location.protocol === "file:") {
    setStatus("Discord OAuth needs an http or https URL. Use a local server or deploy the site first.");
    return;
  }

  const state = createState();
  sessionStorage.setItem("projectRedOAuthState", state);

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: "token",
    scope: "identify",
    state,
    prompt: "consent",
  });

  window.location.href = `https://discord.com/oauth2/authorize?${params.toString()}`;
}

function drawCoverImage(image) {
  const size = canvas.width;
  const scale = Math.max(size / image.width, size / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (size - width) / 2;
  const y = (size - height) / 2;

  ctx.drawImage(image, x, y, width, height);
}

function drawPlaceholder(discordId) {
  const size = canvas.width;
  const initials = discordId ? discordId.slice(-4) : "RED";

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#5f0b0f");
  gradient.addColorStop(1, "#090909");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.42, size * 0.16, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.83, size * 0.3, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = "#fff6f1";
  ctx.font = "900 72px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initials, size / 2, size * 0.53);
}

function applyRedTreatment(discordId) {
  const size = canvas.width;

  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "rgba(255, 24, 24, 0.78)";
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = "screen";
  const glow = ctx.createRadialGradient(size / 2, size / 2, size * 0.04, size / 2, size / 2, size * 0.62);
  glow.addColorStop(0, "rgba(255, 82, 72, 0.58)");
  glow.addColorStop(1, "rgba(255, 82, 72, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = "source-over";
}

function renderAvatar(discordId = lastRenderId) {
  lastRenderId = discordId || "";

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (uploadedImage) {
    drawCoverImage(uploadedImage);
  } else {
    drawPlaceholder(lastRenderId);
  }

  applyRedTreatment(lastRenderId);
  downloadButton.disabled = false;
}

function getDiscordAvatarUrl(user) {
  if (!user?.id) {
    return "";
  }

  if (!user.avatar) {
    const fallbackIndex = user.discriminator === "0" ? Number(BigInt(user.id) >> 22n) % 6 : Number(user.discriminator) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${fallbackIndex}.png`;
  }

  const extension = user.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=512`;
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error("Image failed to load.")), { once: true });
    image.src = url;
  });
}

async function loadDiscordProfile() {
  const accessToken = getStoredToken();

  if (!accessToken) {
    discordLogin.hidden = false;
    discordLogout.hidden = true;
    renderAvatar();
    setStatus("Sign in with Discord to load your avatar automatically, or upload an image.");
    return;
  }

  discordLogin.hidden = true;
  discordLogout.hidden = false;
  setStatus("Loading your Discord avatar...");

  try {
    const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Discord profile request failed.");
    }

    const user = await response.json();
    uploadedImage = await loadImageFromUrl(getDiscordAvatarUrl(user));
    fileName.textContent = `Loaded from Discord: ${user.global_name || user.username}`;
    renderAvatar(user.id);
    setStatus("Discord avatar loaded and turned red. Download it when ready.");
  } catch {
    sessionStorage.removeItem("projectRedDiscordAuth");
    discordLogin.hidden = false;
    discordLogout.hidden = true;
    uploadedImage = null;
    renderAvatar();
    setStatus("Discord sign-in expired or failed. Sign in again, or upload your profile picture.");
  }
}

function loadUploadedImage(file) {
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const image = new Image();
    image.addEventListener("load", () => {
      uploadedImage = image;
      fileName.textContent = file.name;
      renderAvatar();
      setStatus("Uploaded image turned red. Download it when ready.");
    });
    image.src = reader.result;
  });
  reader.readAsDataURL(file);
}

discordLogin.addEventListener("click", startDiscordLogin);

discordLogout.addEventListener("click", () => {
  sessionStorage.removeItem("projectRedDiscordAuth");
  uploadedImage = null;
  fileName.textContent = "Optional fallback: PNG, JPG, or WebP";
  loadDiscordProfile();
});

avatarUpload.addEventListener("change", () => {
  loadUploadedImage(avatarUpload.files[0]);
});

generateButton.addEventListener("click", () => renderAvatar());

downloadButton.addEventListener("click", () => {
  const link = document.createElement("a");
  const suffix = lastRenderId ? `-${lastRenderId}` : "";
  link.download = `project-red-avatar${suffix}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

parseOAuthRedirect();
updateCountdown();
window.setInterval(updateCountdown, 1000);
loadDiscordProfile();
