# Laf 部署指南

由于你需要国内直连且追求极致速度，我们将后端部署到 **Laf (laf.run)**。Laf 是一个开箱即用的云开发平台，非常适合 Node.js 全栈应用。

## 1. 准备工作

1. 访问 [Laf 官网](https://laf.run/) 并注册/登录（支持手机号注册）。
2. 创建一个新应用（建议选择 **香港** 节点以获得最佳速度）。
3. 在应用控制面板左下角的 **依赖管理** 中添加以下 npm 包：
   - `pg`
   - `axios`
   - `cheerio`
   - `bcryptjs`
   - `jsonwebtoken`
   - `openai`

## 2. 设置环境变量

在 Laf 应用的 **设置 -> 环境变量** 中添加以下内容：
- `DATABASE_URL`: 你的 Supabase 连接字符串（已经在你之前的项目中配置过）。
- `JWT_SECRET`: 随便写一个复杂的字符串。
- `AI_API_KEY`: 你的 DeepSeek API Key（如果有）。
- `AI_BASE_URL`: `https://api.deepseek.com`
- `AI_MODEL_NAME`: `deepseek-chat`

## 3. 创建云函数

在 Laf 中创建一个名为 `api` 的云函数，并将以下代码完整覆盖进去：

```javascript
import cloud from '@lafjs/cloud'
import pg from 'pg'
import axios from 'axios'
import * as cheerio from 'cheerio'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import OpenAI from 'openai'

// --- 数据库配置 ---
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- AI 配置 ---
const openai = process.env.AI_API_KEY ? new OpenAI({
  apiKey: process.env.AI_API_KEY,
  baseURL: process.env.AI_BASE_URL || 'https://api.deepseek.com',
}) : null;

// --- 分类逻辑 (Taxonomy) ---
const TAXONOMY = [
  { tag: 'World Models', strongKeywords: ['world model', 'dreamer', 'genie', 'latent dynamics'], weakKeywords: ['model-based', 'imagination'] },
  { tag: 'Model-Based RL', strongKeywords: ['model-based reinforcement learning', 'mbrl', 'muzero'], weakKeywords: ['planning in latent space'] },
  { tag: 'Reinforcement Learning', strongKeywords: ['reinforcement learning', 'ppo', 'sac'], weakKeywords: ['reward function', 'mdp'] },
  { tag: 'Generative Models', strongKeywords: ['generative model', 'diffusion model', 'gan', 'vae'], weakKeywords: ['synthesis'] },
  { tag: 'Video Prediction', strongKeywords: ['video prediction', 'future frame prediction'], weakKeywords: ['temporal consistency'] },
  { tag: 'Robotics', strongKeywords: ['robotics', 'manipulation', 'locomotion'], weakKeywords: ['control'] },
  { tag: 'Planning', strongKeywords: ['trajectory optimization', 'mcts', 'path planning'], weakKeywords: ['search algorithm'] },
  { tag: 'Representation Learning', strongKeywords: ['representation learning', 'contrastive learning', 'jepa'], weakKeywords: ['latent space'] },
  { tag: 'Transformers', strongKeywords: ['transformer', 'attention mechanism', 'vit'], weakKeywords: [] }
];

// --- 核心逻辑函数 ---

async function classifyPaper(title, abstract) {
  const text = (title + ' ' + abstract).toLowerCase();
  const tags = new Set();
  for (const category of TAXONOMY) {
    if (category.strongKeywords.some(k => text.includes(k.toLowerCase()))) {
      tags.add(category.tag);
    } else if (category.weakKeywords.filter(k => text.includes(k.toLowerCase())).length >= 2) {
      tags.add(category.tag);
    }
  }
  return Array.from(tags);
}

async function scrapeArxiv(fullBackfill = false) {
  const BASE_ARXIV_URL = 'https://arxiv.org/search/?query="World+Models"+OR+"Model-Based+Reinforcement+Learning"+OR+"Generative+World+Model"&searchtype=all&source=header&order=-announced_date_first&size=50';
  const stats = { found: 0, added: 0, errors: 0 };
  
  try {
    const { data } = await axios.get(BASE_ARXIV_URL);
    const $ = cheerio.load(data);
    const papers = [];

    $('li.arxiv-result').each((_i, el) => {
      const title = $(el).find('p.title').text().trim();
      const authors = $(el).find('p.authors').text().replace('Authors:', '').split(',').map(a => a.trim());
      const abstract = $(el).find('span.abstract-full').text().trim().replace('(Less)', '');
      const url = $(el).find('p.list-title.is-inline-block > span > a').attr('href');
      
      if (title && url) {
        papers.push({ title, authors, abstract, url, publication_date: new Date().toISOString().split('T')[0] });
      }
    });

    for (const paper of papers) {
      try {
        paper.tags = await classifyPaper(paper.title, paper.abstract);
        await pool.query(
          'INSERT INTO papers (title, authors, abstract, url, publication_date, tags) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (url) DO NOTHING',
          [paper.title, paper.authors, paper.abstract, paper.url, paper.publication_date, paper.tags]
        );
        stats.added++;
      } catch (e) { stats.errors++; }
    }
    return stats;
  } catch (e) { throw e; }
}

// --- 主入口函数 ---

export async function main(ctx) {
  const { method, path } = ctx.request;
  const body = ctx.body;

  // 简单的路由分发
  try {
    // 1. 获取论文列表
    if (path === '/papers' && method === 'GET') {
      const result = await pool.query('SELECT * FROM papers ORDER BY publication_date DESC LIMIT 100');
      return result.rows;
    }

    // 2. 爬取数据
    if (path === '/scrape' && method === 'POST') {
      const stats = await scrapeArxiv();
      return { message: 'Scrape completed', stats };
    }

    // 3. 用户注册
    if (path === '/auth/register' && method === 'POST') {
      const { username, password } = body;
      const hash = await bcrypt.hash(password, 10);
      const result = await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username', [username, hash]);
      const user = result.rows[0];
      const token = jwt.sign(user, process.env.JWT_SECRET);
      return { user, token };
    }

    // 4. 用户登录
    if (path === '/auth/login' && method === 'POST') {
      const { username, password } = body;
      const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      const user = result.rows[0];
      if (user && await bcrypt.compare(password, user.password_hash)) {
        const { password_hash, ...userWithoutPass } = user;
        const token = jwt.sign(userWithoutPass, process.env.JWT_SECRET);
        return { user: userWithoutPass, token };
      }
      ctx.response.status = 401;
      return { message: 'Invalid credentials' };
    }

    return { message: 'Laf Backend is running', path };
  } catch (err) {
    console.error(err);
    ctx.response.status = 500;
    return { error: err.message };
  }
}
```

## 4. 设置定时任务 (Cron)

为了让网站每天自动更新论文，你可以在 Laf 中为 `api` 函数（或者单独创建一个 `scraper` 函数）设置 **定时触发器**：
1. 在函数列表点击 `api` 函数右侧的图标，选择 **触发器**。
2. 添加一个新的定时触发器。
3. Cron 表达式设置为 `0 0 2 * * *` (每天凌晨 2 点自动运行)。
4. 触发动作选择 `POST`，路径填写 `/scrape`。

## 5. 前端配置

1. 在你的前端 `.env` 文件（如果没有就创建一个）中添加：
   `VITE_API_URL=https://你的Laf应用域名/api`
2. 重新打包并部署前端。

---
**提示**：部署完成后，你可以点击 Laf 界面上的“发布”按钮，然后就可以通过分配的二级域名直接访问你的 API 了。
