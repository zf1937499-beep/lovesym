import { NextResponse } from "next/server";
import { CITY_LIST } from "@/lib/weather-config";
import { getWeatherBundle, type CityWeather } from "@/lib/qweather";

export const runtime = "nodejs";
/** 与 fetch 的 revalidate 保持一致：30 分钟 */
export const revalidate = 1800;

function fallback(city: (typeof CITY_LIST)[number]): CityWeather {
  return {
    key: city.key,
    nick: city.nick,
    name: city.name,
    short: city.short,
    lat: city.lat,
    lon: city.lon,
    ok: false,
    now: null,
    air: null,
    alert: null,
    dress: null,
    rainSoon: false,
  };
}

export async function GET() {
  try {
    const cities = await Promise.all(CITY_LIST.map((city) => getWeatherBundle(city)));

    const [a, b] = cities;
    const sameCity =
      Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01;

    return NextResponse.json(
      { cities, sameCity, fetchedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=300",
        },
      }
    );
  } catch {
    // 整体异常也返回 200 + 空数据，让前端统一走降级文案
    return NextResponse.json(
      {
        cities: CITY_LIST.map(fallback),
        sameCity: false,
        fetchedAt: new Date().toISOString(),
        error: "unavailable",
      },
      { status: 200 }
    );
  }
}
