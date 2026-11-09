import { QWEATHER_API_KEY, QWEATHER_API_HOST } from "./weather-secret";
import {
  WEATHER_REVALIDATE,
  type CityConfig,
  locationParam,
  pathLatLon,
} from "./weather-config";

const BASE_URL = `https://${QWEATHER_API_HOST}`;

/**
 * 统一的请求封装：拼 base URL、带请求头、带缓存
 * 缓存 key 就是完整 URL，而 URL 里含经纬度，所以天然按坐标隔离
 */
export async function qweatherGet<T = unknown>(
  path: string,
  params?: Record<string, string | number>
): Promise<T> {
  const search = params
    ? `?${new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)] as [string, string])
      ).toString()}`
    : "";

  const url = `${BASE_URL}${path}${search}`;

  const res = await fetch(url, {
    headers: {
      // Key 只走请求头，不拼在 URL 上
      "X-QW-Api-Key": QWEATHER_API_KEY,
      Accept: "application/json",
    },
    next: { revalidate: WEATHER_REVALIDATE, tags: ["qweather", `qweather:${path}`] },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`QWeather ${path} -> ${res.status}`);
  }

  return (await res.json()) as T;
}

/* ---------------- 图标映射 ---------------- */

const ICON_MAP: Record<string, string> = {
  // 晴
  "100": "☀️",
  "150": "🌙",
  // 多云 / 少云 / 晴间多云
  "101": "⛅",
  "102": "⛅",
  "103": "⛅",
  "151": "☁️",
  "152": "☁️",
  "153": "☁️",
  // 阴
  "104": "☁️",
  // 雨
  "300": "🌦️",
  "301": "⛈️",
  "302": "⛈️",
  "303": "⛈️",
  "304": "⛈️",
  "305": "🌧️",
  "306": "🌧️",
  "307": "🌧️",
  "308": "🌧️",
  "309": "🌦️",
  "310": "🌧️",
  "311": "🌧️",
  "312": "🌧️",
  "313": "🌧️",
  "314": "🌧️",
  "315": "🌧️",
  "316": "🌧️",
  "317": "🌧️",
  "318": "🌧️",
  "399": "🌧️",
  // 雪
  "400": "🌨️",
  "401": "🌨️",
  "402": "❄️",
  "403": "❄️",
  "404": "🌨️",
  "405": "🌨️",
  "406": "🌨️",
  "407": "🌨️",
  "408": "🌨️",
  "409": "❄️",
  "410": "❄️",
  "499": "❄️",
  // 雾 / 霾 / 沙尘
  "500": "🌫️",
  "501": "🌫️",
  "502": "🌫️",
  "503": "🌪️",
  "504": "🌫️",
  "507": "🌪️",
  "508": "🌪️",
  "509": "🌫️",
  "510": "🌫️",
  "511": "🌫️",
  "512": "🌫️",
  "513": "🌫️",
  "514": "🌫️",
  "515": "🌫️",
  // 其他
  "900": "🔥",
  "901": "🥶",
  "999": "🌈",
};

/** 根据 now.icon 取 emoji，未匹配按区间兜底 */
export function weatherEmoji(code?: string | number): string {
  const key = String(code ?? "");
  if (ICON_MAP[key]) return ICON_MAP[key];

  const n = Number(key);
  if (n >= 300 && n < 400) return "🌧️";
  if (n >= 400 && n < 500) return "🌨️";
  if (n >= 500 && n < 600) return "🌫️";

  return "🌈";
}

/* ---------------- 类型 ---------------- */

export type CityWeather = {
  key: string;
  nick: string;
  name: string;
  short: string;
  lat: number;
  lon: number;
  ok: boolean;
  now: {
    temp: number;
    feelsLike: number;
    text: string;
    icon: string;
    emoji: string;
    humidity: number;
    windDir: string;
    windScale: string;
    obsTime: string;
  } | null;
  air: { aqi: number; category: string } | null;
  alert: { headline: string; severity: string } | null;
  dress: { category: string; text: string } | null;
  rainSoon: boolean;
};

type NowResponse = {
  code: string;
  now?: {
    temp: string;
    feelsLike: string;
    text: string;
    icon: string;
    humidity: string;
    windDir: string;
    windScale: string;
    obsTime: string;
  };
};

type AirResponse = {
  indexes?: Array<{ aqi?: number; category?: string; code?: string }>;
};

type AlertResponse = {
  alerts?: Array<{ headline?: string; severity?: string; eventType?: { name?: string } }>;
};

type IndicesResponse = {
  daily?: Array<{ type?: string; category?: string; text?: string }>;
};

type MinutelyResponse = {
  summary?: string;
  minutely?: Array<{ precip?: string; type?: string }>;
};

/* ---------------- 聚合 ---------------- */

function settled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

/**
 * 并行取一个城市的全部天气数据，任何一项失败只影响它自己
 */
export async function getWeatherBundle(city: CityConfig): Promise<CityWeather> {
  const loc = locationParam(city); // 经度,纬度
  const latLon = pathLatLon(city); // 纬度/经度

  const [nowRes, airRes, alertRes, indicesRes, minutelyRes] = await Promise.allSettled([
    qweatherGet<NowResponse>("/v7/weather/now", { location: loc }),
    qweatherGet<AirResponse>(`/airquality/v1/current/${latLon}`),
    qweatherGet<AlertResponse>(`/weatheralert/v1/current/${latLon}`),
    qweatherGet<IndicesResponse>("/v7/indices/1d", { type: 3, location: loc }),
    qweatherGet<MinutelyResponse>("/v7/minutely/5m", { location: loc }),
  ]);

  const nowData = settled(nowRes);
  const now = nowData?.now
    ? {
        temp: Number(nowData.now.temp),
        feelsLike: Number(nowData.now.feelsLike),
        text: nowData.now.text,
        icon: nowData.now.icon,
        emoji: weatherEmoji(nowData.now.icon),
        humidity: Number(nowData.now.humidity),
        windDir: nowData.now.windDir,
        windScale: nowData.now.windScale,
        obsTime: nowData.now.obsTime,
      }
    : null;

  const airData = settled(airRes);
  const airIndex =
    airData?.indexes?.find((i) => i.code === "cn-mee") ?? airData?.indexes?.[0] ?? null;
  const air = airIndex
    ? { aqi: Number(airIndex.aqi ?? 0), category: airIndex.category ?? "" }
    : null;

  const alertData = settled(alertRes);
  const firstAlert = alertData?.alerts?.[0] ?? null;
  const alert = firstAlert
    ? {
        headline: firstAlert.headline ?? firstAlert.eventType?.name ?? "天气预警",
        severity: firstAlert.severity ?? "",
      }
    : null;

  const indicesData = settled(indicesRes);
  const dressItem = indicesData?.daily?.[0] ?? null;
  const dress = dressItem
    ? { category: dressItem.category ?? "", text: dressItem.text ?? "" }
    : null;

  // 未来 2 小时 = 24 个 5 分钟点
  const minutelyData = settled(minutelyRes);
  const rainSoon = Boolean(
    minutelyData?.minutely?.slice(0, 24).some((m) => Number(m.precip ?? 0) > 0)
  );

  return {
    key: city.key,
    nick: city.nick,
    name: city.name,
    short: city.short,
    lat: city.lat,
    lon: city.lon,
    ok: Boolean(now),
    now,
    air,
    alert,
    dress,
    rainSoon,
  };
}
