const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'fake');

async function run() {
  const testModels = ['gemini-flash-latest', 'gemini-pro-latest', 'gemini-3.1-pro-preview', 'gemma-3-12b-it'];
  for (const m of testModels) {
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const result = await model.generateContent("hello");
      console.log(`Success! ${m} works:`, result.response.text());
      break;
    } catch(e) {
      console.log(`Error ${m}:`, e.message);
    }
  }
}
run();
