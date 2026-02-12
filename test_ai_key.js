import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, './backend/.env') });

async function testAI() {
  const apiKey = process.env.AI_API_KEY;
  const baseURL = process.env.AI_BASE_URL || 'https://api.deepseek.com';
  
  console.log('Testing with API Key:', apiKey.substring(0, 5) + '...' + apiKey.substring(apiKey.length - 4));
  console.log('Base URL:', baseURL);

  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
  });

  try {
    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 5
    });
    console.log('Response:', response.choices[0].message.content);
  } catch (error) {
    console.error('Error with default baseURL:', error.message);
    
    console.log('\nTrying with SiliconFlow baseURL...');
    const openaiSF = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.siliconflow.cn/v1',
    });
    try {
      const response = await openaiSF.chat.completions.create({
        model: "deepseek-ai/DeepSeek-V3", // SiliconFlow model name
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 5
      });
      console.log('Response with SiliconFlow:', response.choices[0].message.content);
    } catch (errorSF) {
      console.error('Error with SiliconFlow baseURL:', errorSF.message);
    }
  }
}

testAI();
