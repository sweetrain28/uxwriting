import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Gemini API 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 정적 파일 제공
app.use(express.static('.'));

// 변환 API
app.post('/api/convert', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: '텍스트가 비어있습니다' });
        }

        if (!process.env.GEMINI_API_KEY) {
            console.error('Gemini API 키가 설정되지 않았습니다');
            return res.status(500).json({ error: 'API 키 설정 오류' });
        }

        // Gemini API 호출
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

        const prompt = `다음 텍스트를 5가지 UX Writing 스타일로 변환해줘. JSON 형식으로만 반환해.

원본 텍스트: "${text}"

변환 규칙:
1. friendly (친절한 버전): 따뜻하고 격려하는 톤. 사용자를 지지하고 응원하는 선배의 목소리. 문제 상황도 함께 해결하는 느낌.
2. casual (캐주얼한 버전): 친구 같은 편한 톤. 해요체 사용, 거리감 없고 직설적. 과도한 경어 제거.
3. polite (정중한 버전): 표준 존댓말. 전문적이면서도 친근하고 신뢰도 있는 표현. 일반적인 서비스 톤.
4. formal (경어 버전): 공식적이고 정중한 경어 사용. 높은 신뢰도와 형식성. 기업 공식 문서 스타일.
5. keyword (단어형): 문장이 아닌 명사/키워드 위주. 간결하고 직관적. 중복 제거하고 핵심만 표현.

참고할 가이드라인:
- 토스: 캐주얼한 해요체, 능동형, 긍정형 커뮤니케이션
- 삼성: 단순성, 솔직성, 신뢰도 있는 명확함
- 구름: 친절하고 지지하는 톤, 친근하면서도 전문적

응답 형식 (JSON만 반환, 다른 설명 없이):
{
  "friendly": "변환된 텍스트",
  "casual": "변환된 텍스트",
  "polite": "변환된 텍스트",
  "formal": "변환된 텍스트",
  "keyword": "변환된 텍스트"
}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // JSON 파싱
        let parsedResult;
        try {
            // JSON 부분만 추출
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('JSON을 찾을 수 없음');
            }
            parsedResult = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
            console.error('JSON 파싱 실패:', responseText);
            // 기본값 반환
            parsedResult = {
                friendly: text,
                casual: text,
                polite: text,
                formal: text,
                keyword: text
            };
        }

        res.json(parsedResult);

    } catch (error) {
        console.error('변환 오류:', error);
        res.status(500).json({
            error: error.message || '변환 중 오류가 발생했습니다'
        });
    }
});

// 헬스 체크
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다`);
    console.log('📝 http://localhost:3000 에서 웹앱을 사용할 수 있습니다');

    if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️  GEMINI_API_KEY 환경 변수가 설정되지 않았습니다');
        console.warn('📖 .env 파일에 API 키를 설정하거나 다음을 실행하세요:');
        console.warn('   export GEMINI_API_KEY="your-api-key"');
    }
});
