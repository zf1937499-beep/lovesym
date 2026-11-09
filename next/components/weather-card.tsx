"use client";

import { useCallback, useEffect, useState } from "react";
import type { CityWeather } from "@/lib/qweather";
import { CITIES, distanceKm } from "@/lib/weather-config";

type Payload = {
  cities: CityWeather[];
  sameCity: boolean;
  fetchedAt: string;
  error?: string;
};

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; data: Payload };

const CARD =
  "rounded-[26px] border border-[#ffe2ee] bg-white/90 p-4 shadow-[0_18px_40px_-24px_rgba(201,58,110,0.45)] sm:p-5";

function CityPanel({ city, wide }: { city: CityWeather; wide?: boolean }) {
  if (!city.ok || !city.now) {
    return (
      <div className="grid place-items-center gap-1 rounded-[20px] border border-dashed border-[#ffc2db] bg-[#fff7fa] px-4 py-7 text-center">
        <span className="text-2xl">🌫️</span>
        <p className="text-[12px] text-[#86606e]">{city.nick}那边暂时看不到天气</p>
      </div>
    );
  }

  const n = city.now;

  return (
    <div className={`rounded-[20px] border border-[#ffe2ee] bg-[#fff7fa] p-3.5 ${wide ? "sm:col-span-2" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-[#ffeef5] px-2 py-0.5 text-[11px] font-semibold text-[#c93a6e]">
              {city.nick}
            </span>
            <span className="text-[12px] text-[#86606e]">{city.short}</span>
          </div>
          <div className="mt-1 text-[10px] text-[#b394a1]">{city.name}</div>
        </div>
        <span className="text-[34px] leading-none" aria-hidden="true">
          {n.emoji}
        </span>
      </div>

      <div className="mt-2.5 flex items-end gap-1">
        <b className="text-[30px] font-bold leading-none text-[#c93a6e] tabular-nums">{n.temp}</b>
        <span className="pb-0.5 text-[13px] text-[#c93a6e]">°C</span>
        <span className="ml-1.5 pb-0.5 text-[12px] text-[#4a2c38]">{n.text}</span>
      </div>

      <p className="mt-1 text-[11px] text-[#ac8d99]">
        体感 {n.feelsLike}° · 湿度 {n.humidity}% · {n.windDir} {n.windScale} 级
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {city.air && (
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-[#86606e] ring-1 ring-[#ffe2ee]">
            空气 {city.air.category || "—"}
            {city.air.aqi ? ` · ${city.air.aqi}` : ""}
          </span>
        )}
        {city.dress && (
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-[#86606e] ring-1 ring-[#ffe2ee]">
            穿衣 {city.dress.category || "—"}
          </span>
        )}
        {city.alert && (
          <span
            title={city.alert.headline}
            className="rounded-full bg-[#fff8ea] px-2 py-0.5 text-[10px] text-[#a1651a] ring-1 ring-[#ffd9a8]"
          >
            ⚠️ 有预警
          </span>
        )}
      </div>

      {city.dress?.text && (
        <p className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed text-[#b394a1]">{city.dress.text}</p>
      )}

      {city.rainSoon && (
        <p className="mt-2 text-[11px] text-[#5b8fb9]">☔ 未来 2 小时可能有雨</p>
      )}
    </div>
  );
}

export default function WeatherCard({ className = "" }: { className?: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/weather", { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("bad status");
      const data = (await res.json()) as Payload;
      setState({ status: "ok", data });
    } catch {
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const data = state.status === "ok" ? state.data : null;
  const cities = data?.cities ?? [];
  const allFailed = state.status === "error" || (data ? cities.every((c) => !c.ok) : false);
  const alert = cities.find((c) => c.alert)?.alert ?? null;
  const alertOwner = cities.find((c) => c.alert)?.nick ?? "";
  const sameCity = Boolean(data?.sameCity);
  const uniqueCity = sameCity ? cities[0] : null;

  const updated = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <section className={`${CARD} ${className}`} aria-label="双方天气">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[15px] font-bold text-[#4a2c38]">
          <span aria-hidden="true">🌤</span>双方天气
        </h2>
        <span className="text-[11px] text-[#ac8d99]">
          {state.status === "loading" ? "正在看看..." : updated ? `${updated} 更新` : ""}
        </span>
      </header>

      {/* 预警横幅：没有预警就完全不占位置 */}
      {alert && (
        <div className="mb-3 flex items-start gap-2 rounded-[14px] border border-[#ffd9a8] bg-[#fff8ea] px-3 py-2 text-[12px] leading-snug text-[#a1651a]">
          <span aria-hidden="true">⚠️</span>
          <span>
            {alertOwner}那边：{alert.headline}
          </span>
        </div>
      )}

      {state.status === "loading" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-[132px] animate-pulse rounded-[20px] border border-[#ffe2ee] bg-[#fff7fa]" />
          ))}
        </div>
      )}

      {allFailed && (
        <div className="grid place-items-center gap-1 rounded-[20px] border border-dashed border-[#ffc2db] bg-[#fff7fa] px-4 py-8 text-center">
          <span className="text-[26px]" aria-hidden="true">🌧️</span>
          <p className="text-[13px] font-medium text-[#86606e]">天气暂时获取失败</p>
          <p className="text-[11px] text-[#b394a1]">没关系，反正你在的地方就是好天气</p>
          <button
            type="button"
            onClick={load}
            className="mt-2 rounded-full border border-[#ffc2db] bg-white px-3.5 py-1 text-[11px] text-[#c93a6e] transition hover:bg-[#ffeef5]"
          >
            再试一次
          </button>
        </div>
      )}

      {data && !allFailed && (
        <>
          {sameCity && uniqueCity ? (
            <div className="rounded-[20px] border border-[#ffe2ee] bg-[#fff7fa] px-4 py-5 text-center">
              <p className="text-[12px] text-[#c93a6e]">我们在同一片天空下</p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="text-[34px] leading-none" aria-hidden="true">
                  {uniqueCity.now?.emoji ?? "🌈"}
                </span>
                <b className="text-[30px] font-bold leading-none text-[#c93a6e] tabular-nums">
                  {uniqueCity.now?.temp ?? "--"}
                </b>
                <span className="text-[13px] text-[#c93a6e]">°C</span>
                <span className="text-[12px] text-[#4a2c38]">{uniqueCity.now?.text}</span>
              </div>
              <p className="mt-1 text-[11px] text-[#ac8d99]">
                {uniqueCity.name} · 体感 {uniqueCity.now?.feelsLike ?? "--"}° · 湿度{" "}
                {uniqueCity.now?.humidity ?? "--"}%
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {cities.map((c) => (
                <CityPanel key={c.key} city={c} />
              ))}
            </div>
          )}

          {!sameCity && (
            <p className="mt-3 text-center text-[10.5px] text-[#b394a1]">
              {CITIES.hanhan.short} ⇢ {CITIES.yimeng.short} · 相距约 {distanceKm(CITIES.hanhan, CITIES.yimeng)} 公里
            </p>
          )}
        </>
      )}
    </section>
  );
}
