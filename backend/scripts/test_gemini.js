require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        
        console.log('Sending test request to Gemini...');
        const result = await model.generateContent('مرحبا، قل "تم الربط بنجاح" فقط.');
        const text = await result.response.text();
        console.log('Response from Gemini:', text.trim());
    } catch (e) {
        console.error('Error connecting to Gemini:', e.message);
    }
}

testGemini();
