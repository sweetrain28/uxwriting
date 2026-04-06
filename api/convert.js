module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: '텍스트가 비어있습니다' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API 키 설정 오류' });
        }

        const prompt = `다음 텍스트를 5가지 UX Writing 스타일로 변환해줘. JSON 형식으로만 반환해.

원본 텍스트: "${text}"

변환 규칙:
1. friendly (친절한 버전): 따뜻하고 격려하는 톤. 사용자를 지지하고 응원하는 선배의 목소리.
2. casual (캐주얼한 버전): 친구 같은 편한 톤. 해요체 사용, 거리감 없고 직설적.
3. polite (정중한 버전): 표준 존댓말. 전문적이면서도 친근한 서비스 톤.
4. formal (경어 버전): 공식적이고 정중한 경어. 기업 공식 문서 스타일.
5. keyword (단어형): 문장이 아닌 명사/키워드 위주. 간결하고 직관적.

응답 형식 (JSON만 반환):
{
  "friendly": "변환된 텍스트",
  "casual": "변환된 텍스트",
  "polite": "변환된 텍스트",
  "formal": "변환된 텍스트",
  "keyword": "변환된 텍스트"
}`;

        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            }
        );

        if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            console.error('Gemini API 오류:', errText);
            throw new Error(`Gemini API 오류: ${geminiRes.status}`);
        }

        const geminiData = await geminiRes.json();
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

        let parsedResult;
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('JSON을 찾을 수 없음');
            parsedResult = JSON.parse(jsonMatch[0]);
        } catch (e) {
            parsedResult = { friendly: text, casual: text, polite: text, formal: text, keyword: text };
        }

        res.status(200).json(parsedResult);

    } catch (error) {
        console.error('변환 오류:', error);
        res.status(500).json({ error: error.message || '변환 중 오류가 발생했습니다' });
    }
};
