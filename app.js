const SETTINGS_KEY = "appSettings";

const defaultSettings = {
  userType: "normal",
  location: "",
  notifications: false,
  apiKey: "",
};

const userTypeAdjustments = {
  cold: 2,
  normal: 0,
  hot: -2,
};

const dom = {
  geoBtn: document.getElementById("geoBtn"),
  cityForm: document.getElementById("cityForm"),
  cityInput: document.getElementById("cityInput"),
  statusText: document.getElementById("statusText"),
  dateText: document.getElementById("dateText"),
  mainSuggestion: document.getElementById("mainSuggestion"),
  tempSummary: document.getElementById("tempSummary"),
  subComment: document.getElementById("subComment"),
  detailBody: document.getElementById("detailBody"),
  userTypeSelect: document.getElementById("userTypeSelect"),
  savedLocationInput: document.getElementById("savedLocationInput"),
  notificationToggle: document.getElementById("notificationToggle"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  inAppNotice: document.getElementById("inAppNotice"),
};

let settings = loadSettings();
let activeTimers = [];

init();

function init() {
  bindEvents();
  renderSettings();
  renderDate();

  if (settings.location) {
    dom.cityInput.value = settings.location;
    fetchByCity(settings.location);
  }
}

function bindEvents() {
  dom.geoBtn.addEventListener("click", fetchByCurrentLocation);

  dom.cityForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const city = dom.cityInput.value.trim();
    if (!city) {
      setStatus("地名を入力してください。", true);
      return;
    }
    fetchByCity(city);
  });

  dom.saveSettingsBtn.addEventListener("click", () => {
    settings = {
      userType: dom.userTypeSelect.value,
      location: dom.savedLocationInput.value.trim(),
      notifications: dom.notificationToggle.checked,
      apiKey: dom.apiKeyInput.value.trim(),
    };

    saveSettings(settings);
    setStatus("設定を保存しました。", false);

    if (settings.notifications) {
      requestNotificationPermission();
    }
  });
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...defaultSettings };
    const parsed = JSON.parse(raw);
    return { ...defaultSettings, ...parsed };
  } catch {
    return { ...defaultSettings };
  }
}

function saveSettings(next) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

function renderSettings() {
  dom.userTypeSelect.value = settings.userType;
  dom.savedLocationInput.value = settings.location;
  dom.notificationToggle.checked = settings.notifications;
  dom.apiKeyInput.value = settings.apiKey;
}

function renderDate() {
  const today = new Date();
  dom.dateText.textContent = today.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function setStatus(message, isError) {
  dom.statusText.textContent = message;
  dom.statusText.style.color = isError ? "#dc2626" : "#4b5563";
}

async function fetchByCurrentLocation() {
  if (!settings.apiKey) {
    setStatus("先に設定で OpenWeather APIキーを入力してください。", true);
    return;
  }

  if (!navigator.geolocation) {
    setStatus("このブラウザでは位置情報が利用できません。", true);
    return;
  }

  setStatus("現在地を取得中...", false);

  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      await fetchForecast(coords.latitude, coords.longitude, "現在地");
    },
    () => {
      setStatus("位置情報を取得できませんでした。地名入力でお試しください。", true);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

async function fetchByCity(city) {
  if (!settings.apiKey) {
    setStatus("先に設定で OpenWeather APIキーを入力してください。", true);
    return;
  }

  setStatus(`「${city}」の位置情報を検索中...`, false);

  try {
    const url = new URL("https://api.openweathermap.org/geo/1.0/direct");
    url.searchParams.set("q", city);
    url.searchParams.set("limit", "1");
    url.searchParams.set("appid", settings.apiKey);

    const response = await fetch(url);
    if (!response.ok) throw new Error("geocode failed");

    const list = await response.json();
    if (!list.length) {
      setStatus("地名が見つかりませんでした。", true);
      return;
    }

    const target = list[0];
    settings.location = city;
    dom.savedLocationInput.value = city;
    saveSettings(settings);

    await fetchForecast(target.lat, target.lon, `${target.name}`);
  } catch (error) {
    setStatus(`地名検索に失敗しました: ${error.message}`, true);
  }
}

async function fetchForecast(lat, lon, label) {
  setStatus(`${label}の天気を取得中...`, false);
  try {
    const url = new URL("https://api.openweathermap.org/data/2.5/forecast");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("appid", settings.apiKey);
    url.searchParams.set("units", "metric");
    url.searchParams.set("lang", "ja");

    const response = await fetch(url);
    if (!response.ok) throw new Error("forecast failed");

    const forecast = await response.json();
    const daily = buildTodayForecast(forecast.list, forecast.city.timezone);

    renderSuggestion(daily);
    scheduleNotification(daily);
    setStatus(`${label}の服装提案を更新しました。`, false);
  } catch (error) {
    setStatus(`天気取得に失敗しました: ${error.message}`, true);
  }
}

function buildTodayForecast(items, timezoneOffsetSeconds) {
  const now = new Date();
  const localNowMillis = now.getTime() + timezoneOffsetSeconds * 1000;
  const localNow = new Date(localNowMillis);

  const year = localNow.getUTCFullYear();
  const month = localNow.getUTCMonth();
  const day = localNow.getUTCDate();

  const todayItems = items.filter((item) => {
    const itemLocal = new Date((item.dt + timezoneOffsetSeconds) * 1000);
    return (
      itemLocal.getUTCFullYear() === year &&
      itemLocal.getUTCMonth() === month &&
      itemLocal.getUTCDate() === day
    );
  });

  const basis = todayItems.length ? todayItems : items.slice(0, 8);
  const temps = basis.map((item) => item.main.temp);

  return {
    min: Math.min(...temps),
    max: Math.max(...temps),
    morning: pickPeriodTemp(basis, timezoneOffsetSeconds, 6, 10),
    noon: pickPeriodTemp(basis, timezoneOffsetSeconds, 11, 16),
    night: pickPeriodTemp(basis, timezoneOffsetSeconds, 17, 23),
  };
}

function pickPeriodTemp(items, offset, startHour, endHour) {
  const filtered = items.filter((item) => {
    const d = new Date((item.dt + offset) * 1000);
    const h = d.getUTCHours();
    return h >= startHour && h <= endHour;
  });

  if (!filtered.length) {
    return items[Math.floor(items.length / 2)].main.temp;
  }

  const avg = filtered.reduce((sum, item) => sum + item.main.temp, 0) / filtered.length;
  return Number(avg.toFixed(1));
}

function clothingByTemp(temp, userType) {
  const adjustment = userTypeAdjustments[userType] ?? 0;
  const adjustedTemp = temp - adjustment;

  if (adjustedTemp >= 25) return "👕 半袖";
  if (adjustedTemp >= 20) return "👕 半袖＋🧥 薄手の上着";
  if (adjustedTemp >= 16) return "👔 長袖";
  return "👔 長袖＋🧥 上着";
}

function renderSuggestion(daily) {
  const gap = daily.max - daily.min;
  const morningWear = clothingByTemp(daily.morning, settings.userType);
  const noonWear = clothingByTemp(daily.noon, settings.userType);
  const nightWear = clothingByTemp(daily.night, settings.userType);

  const main = selectMainSuggestion([morningWear, noonWear, nightWear], gap >= 7);
  dom.mainSuggestion.textContent = `今日は ${main} がおすすめ`;
  dom.mainSuggestion.classList.toggle("cold", /長袖/.test(main));
  dom.mainSuggestion.classList.toggle("warm", /半袖/.test(main));

  dom.tempSummary.textContent = `最低 ${daily.min.toFixed(1)}℃ / 最高 ${daily.max.toFixed(1)}℃`;
  dom.subComment.textContent =
    gap >= 7
      ? "寒暖差が大きいため、脱ぎ着しやすい服装と上着を持つのが安心です。"
      : "1日を通して近い気温です。体感に合わせて調整しましょう。";

  dom.detailBody.innerHTML = [
    ["朝", daily.morning, morningWear],
    ["昼", daily.noon, noonWear],
    ["夜", daily.night, nightWear],
  ]
    .map(
      ([time, temp, wear]) =>
        `<tr><td>${time}</td><td>${Number(temp).toFixed(1)}℃</td><td>${wear}</td></tr>`
    )
    .join("");
}

function selectMainSuggestion(items, recommendOuter) {
  const priority = ["👔 長袖＋🧥 上着", "👕 半袖＋🧥 薄手の上着", "👔 長袖", "👕 半袖"];
  const best = priority.find((p) => items.includes(p)) || items[0];

  if (recommendOuter && !best.includes("上着")) {
    return `${best}＋🧥 上着`;
  }

  return best;
}

function scheduleNotification(daily) {
  activeTimers.forEach((t) => clearTimeout(t));
  activeTimers = [];

  if (!settings.notifications) return;

  const morningWear = clothingByTemp(daily.morning, settings.userType);
  const noonWear = clothingByTemp(daily.noon, settings.userType);

  if (morningWear === noonWear) return;

  const now = new Date();
  const notifyAt = new Date();
  notifyAt.setHours(11, 0, 0, 0);

  if (notifyAt <= now) return;

  const delay = notifyAt.getTime() - now.getTime();
  const timer = setTimeout(() => {
    const message = "気温が上がります。半袖になれる準備を！";
    pushNotice(message);
  }, delay);

  activeTimers.push(timer);
}

function requestNotificationPermission() {
  if (!("Notification" in window)) {
    pushNotice("このブラウザでは通知に対応していません。アプリ内表示を使います。");
    return;
  }

  if (Notification.permission === "granted") return;

  Notification.requestPermission().then((permission) => {
    if (permission !== "granted") {
      pushNotice("通知が許可されていないため、アプリ内表示でお知らせします。");
    }
  });
}

function pushNotice(message) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("服装提案アプリ", { body: message });
    return;
  }

  dom.inAppNotice.textContent = message;
  dom.inAppNotice.classList.remove("hidden");
  setTimeout(() => dom.inAppNotice.classList.add("hidden"), 5000);
}
