import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') 
    ? false 
    : { rejectUnauthorized: false }
});

let isDbConnected = false;
const LOCAL_DB_PATH = path.join(process.cwd(), 'papers.json');

// In-memory cache for paper list
let paperCache = null;
let lastCacheUpdate = 0;
let tagsCache = null;
let lastTagsCacheUpdate = 0;
let trendsCache = null;
let lastTrendsCacheUpdate = 0;
const CACHE_DURATION = 60 * 1000; // 1 minute
const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS || 1536);
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
let isVectorSearchReady = false;
let vectorSearchError = null;

const sortByPublicationDateDesc = (a, b) =>
  new Date(b.publication_date).getTime() - new Date(a.publication_date).getTime();

function ensureLocalDbFile() {
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    console.log('📂 Creating local papers.json fallback...');
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify([], null, 2));
  }
}

function readLocalPapers() {
  ensureLocalDbFile();
  return JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf-8'));
}

function writeLocalPapers(papers) {
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(papers, null, 2));
}

async function withPaperStorage({ postgres, local }) {
  if (isDbConnected) {
    return postgres();
  }
  ensureLocalDbFile();
  return local();
}

export const clearPaperCache = () => {
  paperCache = null;
  lastCacheUpdate = 0;
  tagsCache = null;
  lastTagsCacheUpdate = 0;
  trendsCache = null;
  lastTrendsCacheUpdate = 0;
};

// Export getter for DB status
export const getDbStatus = () => isDbConnected;
export const getLocalDbPath = () => LOCAL_DB_PATH;
export const getVectorSearchStatus = () => ({
  enabled: isVectorSearchReady,
  dimensions: EMBEDDING_DIMENSIONS,
  model: EMBEDDING_MODEL,
  error: vectorSearchError
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit, just mark as disconnected
  isDbConnected = false;
});

export const query = (text, params) => pool.query(text, params);

export async function initDatabase() {
  try {
    console.log('🔌 Attempting to connect to PostgreSQL...');
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is NOT set.');
    }
    
    // Test connection
    const client = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL database!');
    client.release(); // Release the client back to the pool
    
    isDbConnected = true;
    await createPapersTable();
    await createUsersTable();
    await createFavoritesTable();
    await createPaperEmbeddingsTable();
    await createPaperCommentsTable();
    await createCommunityPostsTable();
    await createCommunityRepliesTable();
  } catch (err) {
    console.error('❌ Database connection FAILED.');
    console.error('---------------------------------------------------');
    console.error('Error Details:', err.message);
    if (err.code) console.error('Error Code:', err.code);
    if (err.detail) console.error('Error Detail:', err.detail);
    console.error('Hint: Check your DATABASE_URL environment variable.');
    console.error('---------------------------------------------------');
    
    isDbConnected = false;
    isVectorSearchReady = false;
    vectorSearchError = err.message;
    ensureLocalDbFile();
  }
}

export async function createPapersTable() {
  if (!isDbConnected) return; // Skip if using JSON

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS papers (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      authors TEXT[],
      abstract TEXT,
      publication_date DATE,
      url TEXT UNIQUE NOT NULL,
      tags TEXT[],
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await query(createTableQuery);

    // Add tags column if it doesn't exist (migration for existing table)
    await query(`ALTER TABLE papers ADD COLUMN IF NOT EXISTS tags TEXT[]`);
    
    // Add AI summary columns if they don't exist
    await query(`ALTER TABLE papers ADD COLUMN IF NOT EXISTS summary TEXT`);
    await query(`ALTER TABLE papers ADD COLUMN IF NOT EXISTS contribution TEXT`);
    await query(`ALTER TABLE papers ADD COLUMN IF NOT EXISTS limitations TEXT`);
    
    console.log('"papers" table created or updated.');
  } catch (err) {
    console.error('Error creating table:', err);
  }
}

export async function createUsersTable() {
  if (!isDbConnected) return;

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await query(createTableQuery);
    console.log('"users" table created or updated.');
  } catch (err) {
    console.error('Error creating users table:', err);
  }
}

export async function createFavoritesTable() {
  if (!isDbConnected) return;

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS favorites (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      paper_id INTEGER REFERENCES papers(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, paper_id)
    );
  `;

  try {
    await query(createTableQuery);
    console.log('"favorites" table created or updated.');
  } catch (err) {
    console.error('Error creating favorites table:', err);
  }
}

export async function createPaperCommentsTable() {
  if (!isDbConnected) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS paper_comments (
        id SERIAL PRIMARY KEY,
        paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_paper_comments_paper ON paper_comments(paper_id, created_at);
    `);
    console.log('"paper_comments" table ready.');
  } catch (err) {
    console.error('Error creating paper_comments table:', err);
  }
}

export async function createCommunityPostsTable() {
  if (!isDbConnected) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS community_posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_community_posts_time ON community_posts(created_at DESC);
    `);
    console.log('"community_posts" table ready.');
  } catch (err) {
    console.error('Error creating community_posts table:', err);
  }
}

export async function createCommunityRepliesTable() {
  if (!isDbConnected) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS community_replies (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_community_replies_post ON community_replies(post_id, created_at);
    `);
    console.log('"community_replies" table ready.');
  } catch (err) {
    console.error('Error creating community_replies table:', err);
  }
}

export async function createPaperEmbeddingsTable() {
  if (!isDbConnected) {
    isVectorSearchReady = false;
    vectorSearchError = 'Database is disconnected';
    return;
  }

  try {
    await query('CREATE EXTENSION IF NOT EXISTS vector');
    await query(`
      CREATE TABLE IF NOT EXISTS paper_embeddings (
        paper_id INTEGER PRIMARY KEY REFERENCES papers(id) ON DELETE CASCADE,
        embedding vector(${EMBEDDING_DIMENSIONS}) NOT NULL,
        embedding_model TEXT NOT NULL,
        embedding_version TEXT,
        source_hash TEXT NOT NULL,
        source_text TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS paper_embeddings_embedding_idx
      ON paper_embeddings
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);
    `);
    await query(`
      ALTER TABLE paper_embeddings
      ALTER COLUMN embedding TYPE vector(${EMBEDDING_DIMENSIONS})
      USING embedding::vector(${EMBEDDING_DIMENSIONS});
    `);
    isVectorSearchReady = true;
    vectorSearchError = null;
    console.log('"paper_embeddings" table created or updated.');
  } catch (err) {
    isVectorSearchReady = false;
    vectorSearchError = `paper_embeddings init failed: ${err.message}`;
    console.warn('Vector search initialization skipped:', err.message);
  }
}

function embeddingToVectorLiteral(embedding) {
  return `[${embedding.join(',')}]`;
}

export async function getEmbeddingMetadataMap() {
  if (!isDbConnected || !isVectorSearchReady) {
    return new Map();
  }

  const { rows } = await query('SELECT paper_id, source_hash, embedding_model, updated_at FROM paper_embeddings');
  return new Map(rows.map((row) => [row.paper_id, row]));
}

export async function getPaperEmbeddingsByIds(paperIds = []) {
  if (!isDbConnected || !isVectorSearchReady || !Array.isArray(paperIds) || paperIds.length === 0) {
    return [];
  }

  const normalizedIds = Array.from(new Set(paperIds.map((id) => Number(id)).filter((id) => Number.isInteger(id))));
  if (normalizedIds.length === 0) {
    return [];
  }

  const { rows } = await query(
    `
      SELECT paper_id, embedding
      FROM paper_embeddings
      WHERE paper_id = ANY($1::int[])
    `,
    [normalizedIds]
  );

  return rows.map((row) => ({
    paper_id: Number(row.paper_id),
    embedding: String(row.embedding)
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
  }));
}

export async function upsertPaperEmbedding({
  paperId,
  embedding,
  sourceHash,
  sourceText,
  embeddingModel = EMBEDDING_MODEL,
  embeddingVersion = null
}) {
  if (!isDbConnected || !isVectorSearchReady) {
    return false;
  }

  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding dimensions mismatch. Expected ${EMBEDDING_DIMENSIONS}, received ${embedding?.length || 0}.`);
  }

  await query(
    `
      INSERT INTO paper_embeddings (
        paper_id,
        embedding,
        embedding_model,
        embedding_version,
        source_hash,
        source_text
      )
      VALUES ($1, $2::vector, $3, $4, $5, $6)
      ON CONFLICT (paper_id) DO UPDATE SET
        embedding = EXCLUDED.embedding,
        embedding_model = EXCLUDED.embedding_model,
        embedding_version = EXCLUDED.embedding_version,
        source_hash = EXCLUDED.source_hash,
        source_text = EXCLUDED.source_text,
        updated_at = CURRENT_TIMESTAMP
    `,
    [paperId, embeddingToVectorLiteral(embedding), embeddingModel, embeddingVersion, sourceHash, sourceText]
  );

  return true;
}

export async function findSimilarPapers({
  embedding,
  limit = 25,
  filters = {}
}) {
  if (!isDbConnected || !isVectorSearchReady) {
    return [];
  }

  const params = [embeddingToVectorLiteral(embedding)];
  const conditions = [];

  if (filters.tag) {
    params.push(`%${filters.tag}%`);
    conditions.push(`EXISTS (SELECT 1 FROM unnest(p.tags) AS tag WHERE tag ILIKE $${params.length})`);
  }

  if (filters.author) {
    params.push(`%${filters.author}%`);
    conditions.push(`EXISTS (SELECT 1 FROM unnest(p.authors) AS author WHERE author ILIKE $${params.length})`);
  }

  if (filters.year) {
    params.push(Number(filters.year));
    conditions.push(`EXTRACT(YEAR FROM p.publication_date) = $${params.length}`);
  }

  params.push(limit);

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(
    `
      SELECT
        p.*,
        1 - (pe.embedding <=> $1::vector) AS similarity
      FROM paper_embeddings pe
      INNER JOIN papers p ON p.id = pe.paper_id
      ${whereClause}
      ORDER BY pe.embedding <=> $1::vector
      LIMIT $${params.length}
    `,
    params
  );

  return rows.map((row) => ({
    ...row,
    similarity: Number(row.similarity)
  }));
}

export async function addPaper(paper) {
  clearPaperCache();
  await withPaperStorage({
    postgres: async () => {
      const { title, authors, abstract, url, publication_date, tags } = paper;
      const insertQuery = `
        INSERT INTO papers (title, authors, abstract, url, publication_date, tags)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (url) DO UPDATE SET 
          tags = EXCLUDED.tags,
          publication_date = EXCLUDED.publication_date;
      `;
      await query(insertQuery, [title, authors, abstract, url, publication_date, tags || []]);
    },
    local: async () => {
      const papers = readLocalPapers();
      const existingIndex = papers.findIndex((existingPaper) => existingPaper.url === paper.url);

      const newPaper = {
        ...paper,
        id: existingIndex >= 0 ? papers[existingIndex].id : Date.now(),
        created_at: existingIndex >= 0 ? papers[existingIndex].created_at : new Date().toISOString()
      };

      if (existingIndex >= 0) {
        papers[existingIndex] = { ...papers[existingIndex], ...newPaper };
      } else {
        papers.push(newPaper);
      }

      writeLocalPapers(papers);
    }
  });
}

export async function updatePaperTags(id, tags) {
  await withPaperStorage({
    postgres: async () => {
      await query('UPDATE papers SET tags = $1 WHERE id = $2;', [tags, id]);
    },
    local: async () => {
      const papers = readLocalPapers();
      const paperIndex = papers.findIndex((paper) => paper.id === id);
      if (paperIndex >= 0) {
        papers[paperIndex].tags = tags;
        writeLocalPapers(papers);
      }
    }
  });
}

export async function updatePaperSummary(id, analysis) {
  await withPaperStorage({
    postgres: async () => {
      await query(
        `
          UPDATE papers 
          SET summary = $1, contribution = $2, limitations = $3 
          WHERE id = $4;
        `,
        [analysis.summary, analysis.contribution, analysis.limitations, id]
      );
    },
    local: async () => {
      const papers = readLocalPapers();
      const paperIndex = papers.findIndex((paper) => paper.id === id);
      if (paperIndex >= 0) {
        papers[paperIndex] = { ...papers[paperIndex], ...analysis };
        writeLocalPapers(papers);
      }
    }
  });
}

export async function paperExists(url) {
  return withPaperStorage({
    postgres: async () => {
      const { rows } = await query('SELECT 1 FROM papers WHERE url = $1', [url]);
      return rows.length > 0;
    },
    local: async () => {
      const papers = readLocalPapers();
      return papers.some((paper) => paper.url === url);
    }
  });
}

export async function getPaperById(id) {
  return withPaperStorage({
    postgres: async () => {
      const { rows } = await query('SELECT * FROM papers WHERE id = $1', [id]);
      return rows[0];
    },
    local: async () => {
      const papers = readLocalPapers();
      return papers.find((paper) => paper.id === Number(id)) || null;
    }
  });
}

export async function getAllPapers() {
  const now = Date.now();
  if (paperCache && (now - lastCacheUpdate < CACHE_DURATION)) {
    return paperCache;
  }

  const result = await withPaperStorage({
    postgres: async () => {
      const { rows } = await query('SELECT * FROM papers ORDER BY publication_date DESC');
      return rows;
    },
    local: async () => {
      const papers = readLocalPapers();
      return papers.sort(sortByPublicationDateDesc);
    }
  });

  paperCache = result;
  lastCacheUpdate = now;
  return result;
}

export async function getPaperTrends() {
  const now = Date.now();
  if (trendsCache && (now - lastTrendsCacheUpdate < CACHE_DURATION)) {
    return trendsCache;
  }

  const result = await withPaperStorage({
    postgres: async () => {
      const { rows } = await query('SELECT id, publication_date, tags FROM papers ORDER BY publication_date DESC');
      return rows;
    },
    local: async () => {
      const papers = readLocalPapers();
      return papers
        .map(({ id, publication_date, tags }) => ({ id, publication_date, tags }))
        .sort(sortByPublicationDateDesc);
    }
  });

  trendsCache = result;
  lastTrendsCacheUpdate = now;
  return result;
}

export async function getAllTags() {
  const now = Date.now();
  if (tagsCache && (now - lastTagsCacheUpdate < CACHE_DURATION)) {
    return tagsCache;
  }

  const result = await withPaperStorage({
    postgres: async () => {
      const { rows } = await query(`
        SELECT tag, count(*) as count
        FROM (SELECT unnest(tags) as tag FROM papers) t
        WHERE tag IS NOT NULL
        GROUP BY tag
        ORDER BY count DESC, tag ASC
      `);
      return rows;
    },
    local: async () => {
      const papers = readLocalPapers();
      const tagCounts = {};
      papers.forEach((paper) => {
        (paper.tags || []).forEach((tag) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });
      return Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    }
  });

  tagsCache = result;
  lastTagsCacheUpdate = now;
  return result;
}

// ── Paper Comments CRUD ──────────────────────────────────────────────

export async function getPaperComments(paperId) {
  if (!isDbConnected) return [];
  const result = await query(
    `SELECT c.id, c.content, c.created_at, c.updated_at, u.username, c.user_id
     FROM paper_comments c JOIN users u ON c.user_id = u.id
     WHERE c.paper_id = $1 ORDER BY c.created_at ASC`, [paperId]
  );
  return result.rows;
}

export async function addPaperComment(paperId, userId, content) {
  const result = await query(
    `INSERT INTO paper_comments (paper_id, user_id, content) VALUES ($1, $2, $3)
     RETURNING id, content, created_at`,
    [paperId, userId, content]
  );
  return result.rows[0];
}

export async function deletePaperComment(commentId, userId) {
  const result = await query(
    'DELETE FROM paper_comments WHERE id = $1 AND user_id = $2 RETURNING id',
    [commentId, userId]
  );
  return result.rowCount > 0;
}

// ── Community CRUD ───────────────────────────────────────────────────

export async function getCommunityPosts(page = 1, limit = 20) {
  if (!isDbConnected) return { posts: [], total: 0 };
  const offset = (page - 1) * limit;
  const [postsResult, countResult] = await Promise.all([
    query(
      `SELECT p.id, p.title, p.content, p.created_at, u.username,
       (SELECT COUNT(*) FROM community_replies WHERE post_id = p.id)::int AS reply_count
       FROM community_posts p JOIN users u ON p.user_id = u.id
       ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    query('SELECT COUNT(*)::int FROM community_posts')
  ]);
  return {
    posts: postsResult.rows,
    total: countResult.rows[0].count,
    page,
    total_pages: Math.ceil(countResult.rows[0].count / limit)
  };
}

export async function getCommunityPost(postId) {
  if (!isDbConnected) return null;
  const [postResult, repliesResult] = await Promise.all([
    query(
      `SELECT p.id, p.title, p.content, p.created_at, u.username, p.user_id
       FROM community_posts p JOIN users u ON p.user_id = u.id WHERE p.id = $1`,
      [postId]
    ),
    query(
      `SELECT r.id, r.content, r.created_at, u.username, r.user_id
       FROM community_replies r JOIN users u ON r.user_id = u.id
       WHERE r.post_id = $1 ORDER BY r.created_at ASC`,
      [postId]
    )
  ]);
  if (!postResult.rows[0]) return null;
  return { ...postResult.rows[0], replies: repliesResult.rows };
}

export async function addCommunityPost(userId, title, content) {
  const result = await query(
    `INSERT INTO community_posts (user_id, title, content) VALUES ($1, $2, $3)
     RETURNING id, title, content, created_at`,
    [userId, title, content]
  );
  return result.rows[0];
}

export async function deleteCommunityPost(postId, userId) {
  const result = await query(
    'DELETE FROM community_posts WHERE id = $1 AND user_id = $2 RETURNING id',
    [postId, userId]
  );
  return result.rowCount > 0;
}

export async function addCommunityReply(postId, userId, content) {
  const result = await query(
    `INSERT INTO community_replies (post_id, user_id, content) VALUES ($1, $2, $3)
     RETURNING id, content, created_at`,
    [postId, userId, content]
  );
  return result.rows[0];
}

export async function deleteCommunityReply(replyId, userId) {
  const result = await query(
    'DELETE FROM community_replies WHERE id = $1 AND user_id = $2 RETURNING id',
    [replyId, userId]
  );
  return result.rowCount > 0;
}

export async function getUserStats() {
  if (!isDbConnected) {
    return { total_users: 0, users: [] };
  }
  try {
    const [countResult, usersResult] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total_users FROM users'),
      pool.query('SELECT username, created_at FROM users ORDER BY created_at DESC')
    ]);
    return {
      total_users: countResult.rows[0]?.total_users || 0,
      users: usersResult.rows
    };
  } catch (err) {
    console.error('getUserStats error:', err.message);
    return { total_users: 0, users: [] };
  }
}

export async function seedMockData() {
  const MOCK_PAPERS = [
    {
      title: "World Models",
      authors: ["David Ha", "Jürgen Schmidhuber"],
      abstract: "We explore building generative neural network models of popular reinforcement learning environments. Our world model can be trained quickly in an unsupervised manner to learn a compressed spatial and temporal representation of the environment.",
      publication_date: "2018-03-27",
      url: "https://arxiv.org/abs/1803.10122",
      tags: ["World Models", "Reinforcement Learning", "Generative Models"]
    },
    {
      title: "DreamerV3: Mastering Diverse Domains through World Models",
      authors: ["Danijar Hafner", "Jurgis Pasukonis", "Jimmy Ba", "Timothy Lillicrap"],
      abstract: "General intelligence requires solving tasks across many domains. Current reinforcement learning algorithms carry this out by specializing to the specific domain. We present DreamerV3, a general and scalable algorithm based on world models.",
      publication_date: "2023-01-10",
      url: "https://arxiv.org/abs/2301.04104",
      tags: ["Model-Based RL", "World Models", "General Intelligence"]
    },
    {
      title: "Mastering Atari with Discrete World Models",
      authors: ["Danijar Hafner", "Timothy Lillicrap", "Mohammad Norouzi", "Jimmy Ba"],
      abstract: "Intelligent agents need to generalize from past experience to unseen situations. We introduce DreamerV2, a reinforcement learning agent that learns a world model with discrete latent variables.",
      publication_date: "2020-10-01",
      url: "https://arxiv.org/abs/2010.02193",
      tags: ["Model-Based RL", "Discrete Latents", "Atari"]
    }
  ];

  console.log('Seeding database with mock data...');
  for (const paper of MOCK_PAPERS) {
    await addPaper(paper);
  }
  console.log('Database seeded with mock data.');
}
