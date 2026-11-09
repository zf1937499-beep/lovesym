# 双方天气卡片

首页顶部的「瀚瀚 · 寿光 / 伊梦 · 临海」天气卡。数据在服务端取，浏览器只拿到整理好的 JSON。

## 1. 文件清单

### Next.js 版本（drop-in，按 App Router 结构放置）

```
next/lib/weather-config.ts        城市常量、经纬度拼参、距离计算（客户端安全，无密钥）
next/lib/weather-secret.ts        ⚠️ API Key + Host，只允许服务端引用
next/lib/qweather.ts              qweatherGet / 图标映射 / getWeatherBundle
next/app/api/weather/route.ts     Route Handler：GET /api/weather
next/components/weather-card.tsx  首页卡片（"use client"）
```

放置方式：把 `next/lib` 拷到项目的 `lib/`（或 `src/lib`），`next/app/api/weather` 拷到 `app/api/weather`，
`next/components/weather-card.tsx` 拷到 `components/`。组件里用的是 `@/lib/...` 别名，与 Next 默认 tsconfig 一致。

首页接入：

```tsx
import WeatherCard from "@/components/weather-card";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <WeatherCard />
      {/* 其余 Dashboard 卡片 */}
    </main>
  );
}
```

### 当前静态站点（本仓库）

```
server.mjs              本地服务：静态站点 + /api/weather 代理（Key 在服务端）
assets/weather.js       卡片渲染（fetch 相对路径 /api/weather）
index.html              #weatherCard 卡片容器
assets/style.css        .wx-* 样式
```

启动：

```bash
node server.mjs      # http://localhost:4321
```

直接双击打开 `index.html` 时没有 `/api/weather`，卡片会走「天气暂时获取失败」的降级态——这是设计好的行为。

## 2. 接口与缓存

| 用途 | 路径 | 参数顺序 |
|---|---|---|
| 实时天气 | `/v7/weather/now?location={lon},{lat}` | 经度,纬度 |
| 空气质量 | `/airquality/v1/current/{lat}/{lon}` | 纬度/经度 |
| 天气预警 | `/weatheralert/v1/current/{lat}/{lon}` | 纬度/经度 |
| 穿衣指数 | `/v7/indices/1d?type=3&location={lon},{lat}` | 经度,纬度 |
| 分钟降水 | `/v7/minutely/5m?location={lon},{lat}` | 经度,纬度 |

- 请求头 `X-QW-Api-Key` 传 Key，**不拼在 URL 上**；
- `fetch(url, { next: { revalidate: 1800 } })`，缓存 key 就是含经纬度的完整 URL；
- 五个请求用 `Promise.allSettled` 并行，任一失败只把对应字段置空，不影响其他数据；
- 前端只请求 `/api/weather`，从不直接碰和风天气域名。

## 3. 图标映射

`100 ☀️ / 150 🌙 / 101-103 ⛅ / 104 ☁️ / 151-153 ☁️ / 300+ 🌧️（雷阵雨 ⛈️）/ 400+ 🌨️（暴雪 ❄️）/ 500+ 🌫️（沙尘 🌪️）`
未命中按数值区间兜底，再兜底 `🌈`。全部为 emoji，无外部图片依赖。

## 4. 验收清单

| # | 项目 | 方法 | 结果 |
|---|---|---|---|
| 1 | 寿光 / 临海天气正确显示 | `GET /api/weather` | ✅ 寿光 3°C 多云、体感 -1°、湿度 80%、西北风 5 级；临海 16°C 阴、体感 13°、湿度 76% |
| 2 | 请求头带 Key、URL 不带 Key | 查看 `qweatherGet` | ✅ `X-QW-Api-Key` 请求头；URL 仅含 path + 参数 |
| 3 | 30 分钟缓存生效 | 连续两次请求计时 | ✅ 首次 0.435s（回源）→ 第二次 0.008s（命中缓存），约 55× |
| 4 | 单一接口失败不影响整体 | 客户端 stub 掉 `/api/weather` / 单接口超时 | ✅ 整卡降级为「天气暂时获取失败」，其他卡片正常；单接口失败时只缺对应字段（如无 AQI 就不渲染该标签） |
| 5 | 窄屏布局 | 520 / 400 宽 | ✅ 两列变上下堆叠，标签不换行溢出 |
| 6 | 同城合并 | 构造 `sameCity: true` | ✅ 合成一张卡，文案「我们在同一片天空下」 |
| 7 | 预警横幅 | 实际返回两条预警 | ✅ 顶部显示第一条 headline，两条都带「⚠️ 有预警」标记 |
| 8 | 降水提示 | `rainSoon` 为 true 才渲染 | ✅ 无降水时该行完全不占位 |
| 9 | Key 不泄漏到客户端 | 检查 Network / bundle | ✅ 浏览器只请求 `/api/weather`，响应里无 Key；`weather-config.ts` 不含密钥，`weather-secret.ts` 只被服务端引用 |
| 10 | 失败文案温暖 | 断网 | ✅「天气暂时获取失败 / 没关系，反正你在的地方就是好天气」+ 重试按钮 |

## 5. 已知取舍

- 城市的经纬度写死在配置里，没有做城市搜索；
- 预警只展示第一条 headline，不做多预警轮播；
- AQI 只取 `cn-mee` 或第一个 index 的等级，不展示六项污染物；
- 穿衣指数只取 `daily[0]`（今天），不做未来 3 天。
