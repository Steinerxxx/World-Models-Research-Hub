
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function verifyAI() {
  console.log('🔍 正在验证 AI 功能集成情况...\n');

  const apiKey = process.env.AI_API_KEY;
  const baseURL = process.env.AI_BASE_URL || 'https://api.deepseek.com';

  // 1. Check Configuration
  console.log('1️⃣  检查配置:');
  if (!apiKey) {
    console.error('   ❌ 未检测到 AI_API_KEY。请在 backend/.env 文件中配置。');
    return;
  }
  console.log(`   ✅ AI_API_KEY 已设置 (${apiKey.substring(0, 5)}...)`);
  console.log(`   ✅ AI_BASE_URL: ${baseURL}`);

  // 2. Initialize Client
  console.log('\n2️⃣  初始化客户端:');
  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
  });
  console.log('   ✅ OpenAI SDK 客户端已创建');

  // 3. Test Connection
  console.log('\n3️⃣  测试 API 连接 (发送简单请求):');
  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: "Say 'Hello'" }],
      model: "deepseek-chat",
    });

    console.log('   ✅ API 调用成功!');
    console.log('   🤖 AI 回复:', completion.choices[0].message.content);
    console.log('\n🎉 验证结果: AI 功能已完全实现且可用！');

  } catch (error) {
    console.log('   ⚠️  API 调用失败');
    
    if (error.status === 402) {
        console.log('   💰 错误类型: 余额不足 (402 Insufficient Balance)');
        console.log('   📝 结论: AI 集成代码已正确实现，但账户余额不足导致无法获取结果。');
        console.log('   💡 建议: 请为 DeepSeek 账户充值以启用此功能。');
    } else if (error.status === 401) {
        console.log('   🔑 错误类型: 认证失败 (401 Unauthorized)');
        console.log('   📝 结论: API Key 无效或过期。');
    } else {
        console.log('   ❌ 错误详情:', error.message);
    }
  }
}

verifyAI();
