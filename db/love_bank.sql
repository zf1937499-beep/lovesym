-- ============================================================================
--  恋爱银行 / 券系统 · Supabase (PostgreSQL) Schema
--  三张表：love_accounts / coupons / coupon_transactions
--  写入全部走 RPC（security definer），前端只读 + 调函数，避免改余额
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 0. 工具函数：当前用户所属的 couple
--    security definer 绕过 RLS，避免策略里自引用造成无限递归
-- ----------------------------------------------------------------------------
create or replace function public.my_couple_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select couple_id
    from public.love_accounts
   where user_id = auth.uid()
   limit 1;
$$;

-- ----------------------------------------------------------------------------
-- 1. 账户表：一个人一条，余额跟着 couple 走
-- ----------------------------------------------------------------------------
create table if not exists public.love_accounts (
  id            uuid primary key default gen_random_uuid(),
  couple_id     uuid not null,
  user_id       uuid not null references auth.users (id) on delete cascade,
  nickname      text not null default '',
  balance       integer not null default 0 check (balance >= 0),      -- 余额不允许为负
  total_earned  integer not null default 0 check (total_earned >= 0),
  total_spent   integer not null default 0 check (total_spent >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (couple_id, user_id)
);

comment on table public.love_accounts is '恋爱银行账户：每人一条，余额单位为「积分」';

-- ----------------------------------------------------------------------------
-- 2. 券表：一张券 = 一次承诺，发行时由发行人买单
-- ----------------------------------------------------------------------------
create table if not exists public.coupons (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null,
  issuer_id   uuid not null references auth.users (id) on delete cascade,  -- 发行人（扣积分）
  owner_id    uuid not null references auth.users (id) on delete cascade,  -- 持有人（可使用）
  type        text not null default 'custom'
              check (type in ('praise','sorry','wish','chore','treat','custom')),
  title       text not null check (char_length(title) between 1 and 32),
  emoji       text not null default '🎟',
  price       integer not null default 0 check (price between 0 and 999),
  note        text check (char_length(note) <= 80),
  status      text not null default 'active' check (status in ('active','used','revoked')),
  created_at  timestamptz not null default now(),
  used_at     timestamptz,
  use_note    text check (char_length(use_note) <= 80),
  constraint coupon_not_self check (issuer_id <> owner_id),
  constraint coupon_used_consistency check (
    (status = 'used' and used_at is not null) or (status <> 'used')
  )
);

create index if not exists coupons_owner_idx  on public.coupons (owner_id, status, created_at desc);
create index if not exists coupons_couple_idx on public.coupons (couple_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 3. 流水表：只增不改，靠 ref_key 保证同一件事不重复发积分
-- ----------------------------------------------------------------------------
create table if not exists public.coupon_transactions (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null,
  account_id  uuid not null references public.love_accounts (id) on delete cascade,
  coupon_id   uuid references public.coupons (id) on delete set null,
  kind        text not null check (kind in ('earn','issue','use','adjust')),
  amount      integer not null,          -- 赚为正，发行花掉为负，使用为 0
  reason      text not null,
  event       text,                      -- checkin_day / diary / photo ...
  ref_key     text,                      -- 幂等键，如 checkin_day:2026-11-09
  created_at  timestamptz not null default now()
);

create index if not exists coupon_tx_account_idx on public.coupon_transactions (account_id, created_at desc);

-- 同一账户同一个幂等键只能有一条
create unique index if not exists coupon_tx_ref_uniq
  on public.coupon_transactions (account_id, ref_key)
  where ref_key is not null;

-- ----------------------------------------------------------------------------
-- 4. 积分规则 + 发分函数
-- ============================================================================
--   event          points  daily_cap  label
--   checkin_day    2       -          每日打卡
--   checkin_all    5       -          完成全部打卡任务
--   diary          5       15         写一篇日记
--   photo          1       10         上传一张照片
--   wish_done      3       6          完成一个愿望
-- ============================================================================
create or replace function public.award_points(
  p_event   text,
  p_ref_key text default null,
  p_qty     integer default 1
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule          record;
  v_couple        uuid;
  v_account       public.love_accounts;
  v_points        integer;
  v_earned_today  integer;
begin
  select * into v_rule
    from (values
      ('checkin_day', 2, null::integer, '每日打卡'),
      ('checkin_all', 5, null::integer, '完成全部打卡任务'),
      ('diary',       5, 15,            '写一篇日记'),
      ('photo',       1, 10,            '上传一张照片'),
      ('wish_done',   3, 6,             '完成一个愿望')
    ) as t(event, points, daily_cap, label)
   where t.event = p_event;

  if not found then
    raise exception 'unknown event: %', p_event;
  end if;

  v_couple := public.my_couple_id();
  if v_couple is null then
    raise exception 'account not found for current user';
  end if;

  select * into v_account
    from public.love_accounts
   where couple_id = v_couple and user_id = auth.uid()
   for update;

  if not found then
    raise exception 'account not found';
  end if;

  -- 幂等：同一个 ref_key 不重复发
  if p_ref_key is not null and exists (
    select 1 from public.coupon_transactions
     where account_id = v_account.id and ref_key = p_ref_key
  ) then
    return 0;
  end if;

  v_points := v_rule.points * greatest(coalesce(p_qty, 1), 1);

  -- 每日上限
  if v_rule.daily_cap is not null then
    select coalesce(sum(amount), 0) into v_earned_today
      from public.coupon_transactions
     where account_id = v_account.id
       and event = p_event
       and kind = 'earn'
       and created_at >= date_trunc('day', now());
    v_points := least(v_points, greatest(v_rule.daily_cap - v_earned_today, 0));
  end if;

  if v_points <= 0 then
    return 0;
  end if;

  update public.love_accounts
     set balance      = balance + v_points,
         total_earned = total_earned + v_points,
         updated_at   = now()
   where id = v_account.id;

  insert into public.coupon_transactions
    (couple_id, account_id, kind, amount, reason, event, ref_key)
  values
    (v_couple, v_account.id, 'earn', v_points, v_rule.label, p_event, p_ref_key);

  return v_points;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. 发行券：发行人在一个事务里扣分 + 生成券 + 记流水
-- ----------------------------------------------------------------------------
create or replace function public.issue_coupon(
  p_owner_id uuid,
  p_title    text,
  p_type     text    default 'custom',
  p_emoji    text    default '🎟',
  p_price    integer default 0,
  p_note     text    default null
)
returns public.coupons
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issuer  uuid := auth.uid();
  v_couple  uuid;
  v_account public.love_accounts;
  v_coupon  public.coupons;
begin
  v_couple := public.my_couple_id();
  if v_couple is null then raise exception 'no couple'; end if;
  if p_owner_id = v_issuer then raise exception 'cannot issue coupon to yourself'; end if;
  if p_price < 0 then raise exception 'price must be >= 0'; end if;

  select * into v_account
    from public.love_accounts
   where couple_id = v_couple and user_id = v_issuer
   for update;

  if v_account.balance < p_price then
    raise exception 'insufficient balance: have %, need %', v_account.balance, p_price;
  end if;

  update public.love_accounts
     set balance     = balance - p_price,
         total_spent = total_spent + p_price,
         updated_at  = now()
   where id = v_account.id;

  insert into public.coupons
    (couple_id, issuer_id, owner_id, type, title, emoji, price, note)
  values
    (v_couple, v_issuer, p_owner_id, p_type, p_title, p_emoji, p_price, p_note)
  returning * into v_coupon;

  insert into public.coupon_transactions
    (couple_id, account_id, coupon_id, kind, amount, reason, event)
  values
    (v_couple, v_account.id, v_coupon.id, 'issue', -p_price,
     '发行「' || p_title || '」', 'issue');

  return v_coupon;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. 使用券：只能持有人、只能一次，记录时间与备注
-- ----------------------------------------------------------------------------
create or replace function public.use_coupon(
  p_coupon_id uuid,
  p_use_note  text default null
)
returns public.coupons
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon  public.coupons;
  v_account uuid;
begin
  select * into v_coupon
    from public.coupons
   where id = p_coupon_id
   for update;

  if not found then raise exception 'coupon not found'; end if;
  if v_coupon.owner_id <> auth.uid() then raise exception 'not your coupon'; end if;
  if v_coupon.status <> 'active' then raise exception 'coupon already %', v_coupon.status; end if;

  update public.coupons
     set status = 'used', used_at = now(), use_note = p_use_note
   where id = p_coupon_id
  returning * into v_coupon;

  select id into v_account
    from public.love_accounts
   where couple_id = v_coupon.couple_id and user_id = auth.uid();

  insert into public.coupon_transactions
    (couple_id, account_id, coupon_id, kind, amount, reason, event)
  values
    (v_coupon.couple_id, v_account, v_coupon.id, 'use', 0,
     '使用了「' || v_coupon.title || '」', 'use');

  return v_coupon;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. RLS 策略
--    核心：只能看到同一 couple 的数据；写操作走 RPC，直写一律拒绝
-- ----------------------------------------------------------------------------
alter table public.love_accounts        enable row level security;
alter table public.coupons              enable row level security;
alter table public.coupon_transactions  enable row level security;

-- —— love_accounts ——
drop policy if exists accounts_select on public.love_accounts;
create policy accounts_select on public.love_accounts
  for select to authenticated
  using (couple_id = public.my_couple_id());

-- 只允许改昵称，余额只能由 award_points / issue_coupon 改
drop policy if exists accounts_update on public.love_accounts;
create policy accounts_update on public.love_accounts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke insert, update, delete on public.love_accounts from authenticated;
grant  select on public.love_accounts to authenticated;
grant  update (nickname) on public.love_accounts to authenticated;

-- —— coupons ——
drop policy if exists coupons_select on public.coupons;
create policy coupons_select on public.coupons
  for select to authenticated
  using (couple_id = public.my_couple_id());

-- 发行 / 使用 / 撤回都必须走 RPC，客户端不能直接写
revoke insert, update, delete on public.coupons from authenticated;
grant  select on public.coupons to authenticated;

-- —— coupon_transactions ——
drop policy if exists coupon_tx_select on public.coupon_transactions;
create policy coupon_tx_select on public.coupon_transactions
  for select to authenticated
  using (couple_id = public.my_couple_id());

revoke insert, update, delete on public.coupon_transactions from authenticated;
grant  select on public.coupon_transactions to authenticated;

-- ----------------------------------------------------------------------------
-- 8. 只读视图：前端直接查「我收到的券」和「我发出去的券」
-- ----------------------------------------------------------------------------
create or replace view public.my_coupons
with (security_invoker = true) as
  select c.*,
         case when c.owner_id = auth.uid() then 'inbox' else 'outbox' end as direction
    from public.coupons c
   where c.owner_id = auth.uid() or c.issuer_id = auth.uid();

grant select on public.my_coupons to authenticated;
