/**
 * 和风天气 · 公开配置（城市常量、路径拼接、距离计算）
 * 这个文件是「客户端安全」的：不含任何密钥，客户端组件可以放心 import。
 * 密钥与 Host 在 ./weather-secret.ts，只允许服务端引用。
 */

/** 缓存时长：30 分钟 */
export const WEATHER_REVALIDATE = 1800;

export type CityKey = "hanhan" | "yimeng";

export type CityConfig = {
  key: CityKey;
  /** 完整城市名，用于展示 */
  name: string;
  /** 简称，卡片标题用 */
  short: string;
  /** 昵称 */
  nick: string;
  lat: number;
  lon: number;
};

export const CITIES: Record<CityKey, CityConfig> = {
  hanhan: { key: "hanhan", name: "山东潍坊·寿光", short: "寿光", nick: "瀚瀚", lat: 36.86, lon: 118.79 },
  yimeng: { key: "yimeng", name: "浙江台州·临海", short: "临海", nick: "伊梦", lat: 28.85, lon: 121.14 },
};

export const CITY_LIST: CityConfig[] = [CITIES.hanhan, CITIES.yimeng];

/**
 * 实时天气 / 指数 / 分钟降水：location 参数是「经度,纬度」
 * 空气质量 / 预警：路径参数是「纬度/经度」
 * 两者顺序相反，这里统一收口，避免写错
 */
export function locationParam(city: CityConfig): string {
  return `${city.lon},${city.lat}`;
}

export function pathLatLon(city: CityConfig): string {
  return `${city.lat}/${city.lon}`;
}

/** 两点直线距离（km），只用于展示一句文案 */
export function distanceKm(a: CityConfig, b: CityConfig): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round((2 * R * Math.asin(Math.sqrt(h))) / 10) * 10;
}
