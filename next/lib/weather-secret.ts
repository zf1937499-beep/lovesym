/**
 * ⚠️ 服务端专用：API Key 与专属 Host
 * 仅被 lib/qweather.ts（服务端）引用，绝对不要 import 到 "use client" 组件里，
 * 否则 Key 会被打进客户端 bundle。
 */

export const QWEATHER_API_KEY = "00900ecc72ca41018cc722f285cc522b";

/** 专属 API Host，不带 https:// */
export const QWEATHER_API_HOST = "pn3bygxrwa.re.qweatherapi.com";
